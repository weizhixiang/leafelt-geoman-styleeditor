import kinks from '@turf/kinks';
import Draw from './L.PM.Draw';

import { getTranslation } from '../helpers';

Draw.SingleLine = Draw.extend({
  initialize(map) {
    this._map = map;
    this._shape = 'SingleLine';
    this.toolbarButtonName = 'drawSingleline';
    this._doesSelfIntersect = false;
  },
  enable(options) {
    L.Util.setOptions(this, options);

    // enable draw mode
    this._enabled = true;

    // create a new layergroup
    this._layerGroup = new L.LayerGroup();
    this._layerGroup._pmTempLayer = true;
    this._layerGroup.addTo(this._map);

    // this is the polyLine that'll make up the polygon
    this._layer = L.polyline([], this.options.templineStyle);
    this._layer._pmTempLayer = true;
    this._layerGroup.addLayer(this._layer);

    // this is the hintline from the mouse cursor to the last marker
    this._hintline = L.polyline([], this.options.hintlineStyle);
    this._hintline._pmTempLayer = true;
    this._layerGroup.addLayer(this._hintline);

    // this is the hintmarker on the mouse cursor
    this._hintMarker = L.marker(this._map.getCenter(), {
      icon: L.divIcon({ className: 'marker-icon cursor-marker' }),
    });
    this._hintMarker._pmTempLayer = true;
    this._layerGroup.addLayer(this._hintMarker);

    // show the hintmarker if the option is set
    if (this.options.cursorMarker) {
      L.DomUtil.addClass(this._hintMarker._icon, 'visible');
    }

    // add tooltip to hintmarker
    if (this.options.tooltips) {
      this._hintMarker
        .bindTooltip(getTranslation('tooltips.firstVertex'), {
          permanent: true,
          offset: L.point(0, 10),
          direction: 'bottom',

          opacity: 0.8,
        })
        .openTooltip();
    }

    // change map cursor
    this._map._container.style.cursor = 'crosshair';

    // create a polygon-point on click
    this._map.on('click', this._createVertex, this);

    // finish on layer event
    // #http://leafletjs.com/reference-1.2.0.html#interactive-layer-click

    // sync hint marker with mouse cursor
    this._map.on('mousemove', this._syncHintMarker, this);

    // sync the hintline with hint marker
    this._hintMarker.on('move', this._syncHintLine, this);

    // fire drawstart event
    this._map.fire('pm:drawstart', {
      shape: this._shape,
      workingLayer: this._layer,
    });

    // toggle the draw button of the Toolbar in case drawing mode got enabled without the button
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);

    // an array used in the snapping mixin.
    // TODO: think about moving this somewhere else?
    this._otherSnapLayers = [];
  },
  disable() {
    // disable draw mode

    // cancel, if drawing mode isn't even enabled
    if (!this._enabled) {
      return;
    }

    this._enabled = false;

    // reset cursor
    this._map._container.style.cursor = '';

    // unbind listeners
    this._map.off('click', this._finishShape, this);
    this._map.off('click', this._createVertex, this);
    this._map.off('mousemove', this._syncHintMarker, this);

   
    this._map.doubleClickZoom.enable();


    // remove layer
    this._map.removeLayer(this._layerGroup);

    // fire drawend event
    this._map.fire('pm:drawend', { shape: this._shape });

    // toggle the draw button of the Toolbar in case drawing mode got disabled without the button
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);

    // cleanup snapping
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  _syncHintLine() {
    const polyPoints = this._layer.getLatLngs();

    if (polyPoints.length > 0) {
      const lastPolygonPoint = polyPoints[polyPoints.length - 1];

      // set coords for hintline from marker to last vertex of drawin polyline
      this._hintline.setLatLngs([
        lastPolygonPoint,
        this._hintMarker.getLatLng(),
      ]);
    }
  },
  _syncHintMarker(e) {
    // move the cursor marker
    this._hintMarker.setLatLng(e.latlng);

    // if snapping is enabled, do it
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }

    // if self-intersection is forbidden, handle it
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(true, e.latlng);
    }
  },
  _removeLastVertex() {
    // remove last coords
    const coords = this._layer.getLatLngs();
    const removedCoord = coords.pop();

    // if all coords are gone, cancel drawing
    if (coords.length < 1) {
      this.disable();
      return;
    }

    // find corresponding marker
    const marker = this._layerGroup
      .getLayers()
      .filter(l => l instanceof L.Marker)
      .filter(l => !L.DomUtil.hasClass(l._icon, 'cursor-marker'))
      .find(l => l.getLatLng() === removedCoord);

    // remove that marker
    this._layerGroup.removeLayer(marker);

    // update layer with new coords
    this._layer.setLatLngs(coords);

    // sync the hintline again
    this._syncHintLine();
  },
  _createVertex(e) {

    // assign the coordinate of the click to the hintMarker, that's necessary for
    // mobile where the marker can't follow a cursor
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }

    // get coordinate for new vertex by hintMarker (cursor marker)
    const latlng = this._hintMarker.getLatLng();



    // is this the first point?
    const first = this._layer.getLatLngs().length === 0;

    this._layer.addLatLng(latlng);
    const newMarker = this._createMarker(latlng, first);

    this._hintline.setLatLngs([latlng, latlng]);

    this._layer.fire('pm:vertexadded', {
      shape: this._shape,
      workingLayer: this._layer,
      marker: newMarker,
      latlng,
    });
    this._map.on('click', this._finishShape, this);
  },
  _finishShape() {

    // get coordinates
    const coords = this._layer.getLatLngs();

    // if there is only one coords, don't finish the shape!
    if (coords.length <= 1) {
      return;
    }


    // create the leaflet shape and add it to the map
    const polylineLayer = L.polyline(coords, this.options.pathOptions).addTo(
      this._map
      
    );
    polylineLayer.setText(coords[0].distanceTo(coords[1]).toFixed(0)+"m", { offset: -5,center: true, attributes: { fill: 'red' } });
    //console.log(polylineLayer);
    // disable drawing
    this.disable();

    // fire the pm:create event and pass shape and layer
    this._map.fire('pm:create', {
      shape: this._shape,
      layer: polylineLayer,
    });

    if (this.options.snappable) {
      this._cleanupSnapping();
    }
  },
  _createMarker(latlng, first) {
    // create the new marker
    const marker = new L.Marker(latlng, {
      draggable: false,
      icon: L.divIcon({ className: 'marker-icon' }),
    });
    marker._pmTempLayer = true;

    // add it to the map
    this._layerGroup.addLayer(marker);

    // a click on any marker finishes this shape
    marker.on('click', this._finishShape, this);

    // handle tooltip text
    if (first) {
      this._hintMarker.setTooltipContent(
        getTranslation('tooltips.continueLine')
      );
    }
    const second = this._layer.getLatLngs().length === 2;

    if (second) {
      this._hintMarker.setTooltipContent(getTranslation('tooltips.finishLine'));
    }

    return marker;
  },
});
