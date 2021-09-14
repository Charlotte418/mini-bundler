const fs = require('fs');
const path = require('path');
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require('@babel/core');

let ID = 0;

function examineFile(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    
    const ast = parser.parse(content, {
        sourceType: "module"
    });

    dependencies = [];
    const id = ID++;
    traverse(ast, {
        ImportDeclaration: function(path) {
            dependencies.push(path.node.source.value);
        }
    });

    const { code } = babel.transform(content, {
        presets: [
            "@babel/preset-env"
        ]
     });

    return { id, filename, dependencies, code };
}

function generateDepGraph(entry) {
    let results = [examineFile(entry)];
    for (const fileInfo of results) {
        fileInfo.mapping = {}
        dirname = path.dirname(fileInfo.filename)
        for (const dep of fileInfo.dependencies) {
            curInfo = examineFile(path.join(dirname, dep));
            fileInfo.mapping[dep] = curInfo.id;
            results.push(curInfo);
        }
    }
    return results;
}

function bundle(graph) {
    let modules = '';

    for (const module of graph) {
        modules += `${module.id}:[
            function(require, module, exports) {
                ${module.code}
            },
            ${JSON.stringify(module.mapping)}],`
    }

    const bundledResult = `(function(modules) {
        function require(id) {
            const [fn, mapping] = modules[id];
            function localRequire(relativePath) {
                const id = mapping[relativePath];
                return require(id);
            }
            const module = { exports: {} }
            fn(localRequire, module, module.exports);
            return module.exports;
        }
        require(0);
    })({${modules}})`

    return bundledResult;
}

graph = generateDepGraph('./test/a.js');
res = bundle(graph);
// console.log(res);
eval(res);