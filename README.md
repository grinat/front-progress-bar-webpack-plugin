## front-progress-bar-webpack-plugin
Shows the status of the build in percent on the your app page(e.g: index.html). In the case of an update error, it displays an error.
Tested on webpack 3

### Install
```
npm install front-progress-bar-webpack-plugin --save-dev
```

### Usage

1. Put to webpack
```
const FrontProgressBar = require('front-progress-bar-webpack-plugin/FrontProgressBar')

// add to webpack plugins
plugins: [
   ...
   new FrontProgressBar({
     templateProgress: 'index-process.html', // path to template which showed on update
     templateFail: 'index-fail.html',  // path to template which showed on error
     indexFile: 'index.html', // your index file
     errorTag: '{{%error%}}', // tag which replaced by errors in index-fail.html
     errorsCount: 3 // showed errros in errorTag
   })
   ...
]
```

2. Prepare templates

index-process.html

```
<!DOCTYPE html>
<html lang="en">
<body>
<div class="progress-wrapper">
    <div id="progressPercent" style="width:5%;"></div>
</div>
<div id="progressMessage">Preparing...</div>
<style type="text/css">
  .progress-wrapper {
    width: 70%;
    background-color: white;
    height: 20px;
    display: inline-block;;
    border: 1px solid #eee;
    text-align: center;
  }
  #progressPercent {
    height: 100%;
    background-color: green;
    color: white;
  }
</style>
<script>
  // listen percent update
  window.addEventListener('progress.update', function (e) {
    document.getElementById('progressPercent').style.width = e.detail.percent + '%'
    document.getElementById('progressPercent').innerHTML = e.detail.percent + '%'
    document.getElementById('progressMessage').innerHTML = e.detail.message
  })
  // listen on error
  window.addEventListener('progress.error', function (e) {
    document.getElementById('progressMessage').innerHTML = 'Error: ' + e.detail.toString()
  })
</script>
</body>
</html>

```

index-fail.html

```
<!DOCTYPE html>
<html lang="en">
<body>
  <h3>
    Fatal errors:
  </h3>
  <pre>{{%error%}}</pre>
</body>
</html>
```
