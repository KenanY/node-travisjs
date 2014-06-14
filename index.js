var ghauth = require('ghauth');
var request = require('request');
var Configstore = require('configstore');
var ghslug = require('github-slug');
var yaml = require('yamljs');
var gittravis = require('git-travis');
var fs = require('fs');

var travisUrl = 'https://api.travis-ci.org';
var userAgent = 'travis-init.js';

var travisHeaders = {
  'User-Agent': userAgent,
  'Accept': 'application/vnd.travis-ci.2+json'
};

exports.hook = function () {
  getToken(function (token) {
    travisHeaders.Authorization = 'token ' + token;
    // get slug
    ghslug('./', function (err, slug) {
      if(err) return console.error(err);
        console.log('Activating hook for ' + slug + '...');
        var req = {};
        req.url = travisUrl  + '/repos/' + slug;
        req.headers = travisHeaders;
        // get id for the repo
        request.get(req, function (err, response, data) {
          if(err) return console.error(err);
          if(response.statusCode !== 200)
            return console.error('Error' + response.statusCode);
          var hookId = JSON.parse(data).repo.id;
          // turn on the hook
          var req = {};
          req.url = travisUrl + '/hooks';
          req.headers = travisHeaders;
          req.json = {
            hook: {
              id: hookId,
              active: true
            }
          }
          request.put(req, function (err, response, data) {
            if(err) return console.error(err);
            if(response.statusCode !== 200)
              return console.error('Error' + response.statusCode);
            console.log('Activated hook for ' + slug);
          });
        });
        
    });
  });  
}

exports.badge = function () {
  ghslug('./', function (err, slug) {
    console.log('[![Build Status](https://travis-ci.org/' + slug 
      + '.svg?branch=master)](https://travis-ci.org/' + slug + ')'
    );
  });
}

exports.yml = function () {
  var opts = {
    language: 'node_js',
    node_js: ['0.10', '0.8']
  }
  var yml = yaml.stringify(opts, 10);
  console.log('Writing .travis.yml:');
  console.log(yml);
  fs.writeFileSync('./.travis.yml', yml);
}

exports.status = function () {
  // TODO: Other branches
  ghslug('./', function (err, slug) {
    slug = slug.split('/');
    gittravis.print(slug[0], slug[1], 'master');
  });
}

function getToken(cb) {
  var authOpts = {
    scopes: [
      "read:org",
      "user:email",
      "repo_deployment",
      "repo:status",
      "write:repo_hook"
    ],
    userAgent: userAgent,
    note: userAgent,
    noSave: true
  }
  
  var config = new Configstore('travis-init');
  var token = config.get('token');
  if(token) {
    cb(token)
  } else {
    ghauth(authOpts, function (err, authData) {
      if(err) return console.error(err);
      var req = {};
      req.url = travisUrl + '/auth/github';
      req.headers = travisHeaders;
      req.json = { 'github_token': authData.token };
      req.method = 'POST';
      req.encoding = 'utf8'

      request(req, function (err, response, body) {
        if(err) return console.error(err);
        if(response.statusCode !== 200) 
          return console.error('Error ' + response.statusCode)
          if(body.access_token) {
            config.set('token', body.access_token);
            cb(token);
          }
      });
    });  
  }
}