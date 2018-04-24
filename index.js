let path = require('path')
let fs = require('fs')

const PROGRESS_INFO = 'progress-info.json'
const INSERTED_SCRIPT = `
<script>
  function initCounter () {
    var errorCounter = 0;
    var reloadInterval = null;
    var lastProgress = {};

    var updateCounter = function () {
      fetch('{{%publicPath%}}${PROGRESS_INFO}?r=' + Math.random()).then(r => {
        if (r.status === 404) {
          errorCounter++;
        }
        return r.json();
      }).then(data => {
        errorCounter = 0;
        sendEvent('progress.update', data);
        lastProgress = data;
      }).catch(e => {
        if (errorCounter > 5) {
          clearInterval(reloadInterval);
          if (lastProgress && lastProgress.percent && lastProgress.percent > 60) {
            location.reload(true);
          } else {
            sendEvent('progress.error', e);
          }
        }
      })
    }

    var sendEvent = function (type, detail) {
      var evt = new CustomEvent(type, {detail: detail});
      window.dispatchEvent(evt);
    }

    reloadInterval = setInterval(updateCounter, 1500);
  }
  initCounter();
</script>`

class FrontProgressBar {

  constructor (options) {
    this.options = Object.assign({
      templateProgress: 'index-process.html',
      templateFail: 'index-fail.html',
      indexFile: 'index.html',
      errorTag: '{{%error%}}',
      errorsCount: 3
    }, options)
  }

  updateProgress (per, message) {
    if (this.progressInfoPath && per) {
      let percent = Math.ceil(per * 100)
      let info = JSON.stringify({
        percent,
        message
      })

      if (this.prevPercent && this.prevPercent === percent) {
        return
      }

      if (fs.existsSync(this.progressInfoPath) === false) {
        fs.writeFileSync(this.progressInfoPath, info)
      }

      this.writeToFileWithMessage(
        this.progressInfoPath,
        this.progressInfoPath,
        info
      )
      this.prevPercent = percent
    }
  }

  getOutputBasedPath (filename) {
    return path.join(
      this.output.path,
      '/',
      filename
    )
  }

  getRelativePath (filename) {
    if (filename.indexOf('/') > -1 || filename.indexOf('\\') > -1) {
      return filename
    }
    return path.join(
      __dirname,
      '../../',
      filename
    )
  }

  // use sync for prevent break data
  writeToFileWithMessage (source, dest, msg = null, tag) {
    let data = fs.readFileSync(source, 'utf8')
    let regExp = null
    let result = null
    if (tag) {
      regExp = new RegExp(tag, 'g')
      result = data.replace(regExp, msg)
    } else if (msg) {
      result = msg
    } else {
      result = data
    }

    fs.writeFileSync(dest, result, 'utf8')
  }

  onEntryOption () {
    this.writeToFileWithMessage(
      this.templateProgressPath,
      this.outputIndexFilePath,
      INSERTED_SCRIPT.replace(/{{%publicPath%}}/, this.output.publicPath) + '</body>',
      '<\/body>'
    )
  }

  onAfterEmit (compilation, callback) {
    if (compilation.errors && compilation.errors.length) {
      let errors = compilation.errors.slice(0, this.options.errorsCount)
      this.writeToFileWithMessage(
        this.templateFailPath,
        this.outputIndexFilePath,
        errors.join(`\n\n`),
        this.options.errorTag
      )
    }
    callback()
  }

  updateOptions (compiler) {
    this.output = compiler.options.output
    this.templateProgressPath = this.getRelativePath(this.options.templateProgress)
    this.templateFailPath = this.getRelativePath(this.options.templateFail)
    this.outputIndexFilePath = this.getOutputBasedPath(this.options.indexFile)
    this.progressInfoPath = this.getOutputBasedPath(PROGRESS_INFO)
  }

  apply (compiler) {
    this.updateOptions(compiler)

    this.attachProgress(compiler)
    compiler.plugin('entry-option', (...args) => this.onEntryOption(...args))
    compiler.plugin('after-emit', (...args) => this.onAfterEmit(...args))
    compiler.plugin('done', () => {
      fs.unlinkSync(this.progressInfoPath)
    })
    compiler.plugin('failed', err => {
      fs.unlinkSync(this.progressInfoPath)
      this.writeToFileWithMessage(
        this.templateFailPath,
        this.outputIndexFilePath,
        err.toString(),
        this.options.errorTag
      )
    })
  }

  /**
   * Used parts from ProgressPlugin by obias Koppers
   */
  attachProgress (compiler) {
    const handler = (...args) => this.updateProgress(...args)

    let lastModulesCount = 0;
    let moduleCount = 500;
    let doneModules = 0;
    const activeModules = [];

    const update = function update (module) {
      handler(
        0.1 + (doneModules / Math.max(lastModulesCount, moduleCount)) * 0.6,
        "building modules",
        `${doneModules}/${moduleCount} modules`,
        `${activeModules.length} active`,
        activeModules[activeModules.length - 1]
      );
    };

    const moduleDone = function moduleDone(module) {
      doneModules++;
      const ident = module.identifier();
      if(ident) {
        const idx = activeModules.indexOf(ident);
        if(idx >= 0) activeModules.splice(idx, 1);
      }
      update();
    };
    compiler.plugin("compilation", function(compilation) {
      if(compilation.compiler.isChild()) return;
      lastModulesCount = moduleCount;
      moduleCount = 0;
      doneModules = 0;
      handler(0, "compiling");
      compilation.plugin("build-module", function(module) {
        moduleCount++;
        const ident = module.identifier();
        if(ident) {
          activeModules.push(ident);
        }
        update();
      });
      compilation.plugin("failed-module", moduleDone);
      compilation.plugin("succeed-module", moduleDone);
      const syncHooks = {
        "seal": [0.71, "sealing"],
        "optimize": [0.72, "optimizing"],
        "optimize-modules-basic": [0.73, "basic module optimization"],
        "optimize-modules": [0.74, "module optimization"],
        "optimize-modules-advanced": [0.75, "advanced module optimization"],
        "optimize-chunks-basic": [0.76, "basic chunk optimization"],
        "optimize-chunks": [0.77, "chunk optimization"],
        "optimize-chunks-advanced": [0.78, "advanced chunk optimization"],
        // optimize-tree
        "optimize-chunk-modules": [0.80, "chunk modules optimization"],
        "optimize-chunk-modules-advanced": [0.81, "advanced chunk modules optimization"],
        "revive-modules": [0.82, "module reviving"],
        "optimize-module-order": [0.83, "module order optimization"],
        "optimize-module-ids": [0.84, "module id optimization"],
        "revive-chunks": [0.85, "chunk reviving"],
        "optimize-chunk-order": [0.86, "chunk order optimization"],
        "optimize-chunk-ids": [0.87, "chunk id optimization"],
        "before-hash": [0.88, "hashing"],
        "before-module-assets": [0.89, "module assets processing"],
        "before-chunk-assets": [0.90, "chunk assets processing"],
        "additional-chunk-assets": [0.91, "additional chunk assets processing"],
        "record": [0.92, "recording"]
      };
      Object.keys(syncHooks).forEach(name => {
        let pass = 0;
        const settings = syncHooks[name];
        compilation.plugin(name, () => {
          if(pass++ > 0)
            handler(settings[0], settings[1], `pass ${pass}`);
          else
            handler(settings[0], settings[1]);
        });
      });
      compilation.plugin("optimize-tree", (chunks, modules, callback) => {
        handler(0.79, "module and chunk tree optimization");
        callback();
      });
      compilation.plugin("additional-assets", callback => {
        handler(0.91, "additional asset processing");
        callback();
      });
      compilation.plugin("optimize-chunk-assets", (chunks, callback) => {
        handler(0.92, "chunk asset optimization");
        callback();
      });
      compilation.plugin("optimize-assets", (assets, callback) => {
        handler(0.94, "asset optimization");
        callback();
      });
    });
    compiler.plugin("emit", (compilation, callback) => {
      handler(0.95, "emitting");
      callback();
    });
    compiler.plugin("done", () => {
      handler(1, "");
    });
  }
}

module.exports = FrontProgressBar
