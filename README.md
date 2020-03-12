# leafelt-geoman-styleeditor
###集成以下三个leaflet插件
1. https://github.com/geoman-io/leaflet-geoman
2. https://github.com/dwilhelm89/Leaflet.StyleEditor
3. https://github.com/makinacorpus/Leaflet.TextPath
### 感谢原作者创造如此美好的插件！
1. 在Leaflet.StyleEditor中增加了监听geoman创建新图形的接口，使得创建完图形即可设置样式，
2. 在leaflet-geoman中修改了默认marker图标，使得与Leaflet.StyleEditor默认图标一致，
3. 在leaflet-geoman中添加一种单线段，可在上面显示距离，距离计算使用的leaflet默认方法的distanceTo，长距离计算是否按大地线，请自行研究
4. 因为引入Leaflet.TextPath，所有polyline类型的图形即可继承Leaflet.TextPath方法样式设置沿线文字
5. 继承以上三个事件中所有events，请自行查看源文档
6. demo中的index.html简单示例
