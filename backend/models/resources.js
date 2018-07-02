/* eslint no-param-reassign: 0 */

/**
 * @fileoverview Resource class
 * @module models/resource
 * @requires {@link external:kind-of}
 * @requires {@link external:express}
 * @requires helpers/logger
 * @requires helpers/security
 * @requires models/errors
 */

const kindOf = require('kind-of');
const express = require('express');
const logger = require('../helpers/logger');
const { requiresLogin, requiresRole } = require('../helpers/security');
const { NotFoundResourceError } = require('./errors');

/**
 * Parses query parameter on resource endpoint to construct options of db request
 * @function parseQueryParameters
 * @private
 * @param {Object} query - Request query
 * @returns options object of db request
 */
function parseQueryParameters(query) {
  const options = { populate: false };
  if (query) {
    if (query.populate) {
      if (query.populate === 'true') options.populate = true;
      else if (/^[a-zA-Z,]+$/.test(query.populate)) options.populate = query.populate.split(',');
      else logger.error(`Resource: received request with invalid populate query parameter '${query.populate}'`);
    }
    if (query.sort) {
      if (/^[a-zA-Z,-]+$/.test(query.sort)) options.sort = query.sort.split(',');
      else logger.error(`Resource: received request with invalid sort query parameter '${query.sort}'`);
    }
    if (query.limit) {
      if (/^[0-9]+$/.test(query.limit)) options.limit = Number(query.limit);
      else logger.error(`Resource: received request with invalid limit query parameter '${query.limit}'`);
    }
    if (query.skip) {
      if (/^[0-9]+$/.test(query.skip)) options.skip = Number(query.skip);
      else logger.error(`Resource: received request with invalid skip query parameter '${query.skip}'`);
    }
  }
  return options;
}

/**
 * Removes given properties from all elements of the list
 * @function listFilterProperties
 * @private
 * @param {Object[]}        list  - List of elements to be filtered
 * @param {string|string[]} props - Property or list of properties to remove
 * @returns the list of elements filtered
 */
function listFilterProperties(l) {
  if (l && l.length > 0) l.forEach(element => element.restFilter());
  return l;
}

/**
 * Creates a resource list endpoint function
 * @function list
 * @private
 * @param {Object} document - Resource document
 * @returns a function handling call of document find method
 */
function list(resource) {
  return (req, res, next) => {
    const options = parseQueryParameters(req.query);
    logger.debug(`Resource list: listing '${resource.name}' documents with options '${JSON.stringify(options)}'`);
    resource.document.find({}, options)
      .then(l => res.status(200).json(listFilterProperties(l)))
      .catch(err => next(err));
  };
}

/**
 * Creates a sub resource list endpoint function
 * @function listSubResource
 * @private
 * @param {Object} document - Resource document
 * @returns a function handling call of document sub resource find method
 */
function listSubResource(resource) {
  return (req, res, next) => {
    const options = parseQueryParameters(req.query);
    const subResource = resource.config.subResourcesMap.get(req.path.substr(req.path.lastIndexOf('/') + 1));
    logger.debug(`Sub resource list: listing sub resource '${subResource.name}' of resource '${resource.name}' document with id '${req.params.id}' with options '${JSON.stringify(options)}'`);
    resource.document.findOne({ _id: req.params.id }, { populate: false })
      .then((element) => {
        if (!element) next(new NotFoundResourceError(resource.name, req.params.id));
        else {
          if (!Array.isArray(element[subResource.property])) element[subResource.property] = [element[subResource.property]];
          subResource.document.find({ _id: { $in: element[subResource.property] } }, options)
            .then(l => res.status(200).json(listFilterProperties(l)))
            .catch(err => next(err));
        }
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a resource get endpoint function
 * @function get
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document findOne method
 */
function get(resource) {
  return (req, res, next) => {
    const options = parseQueryParameters(req.query);
    // Only populate option is allowed
    delete options.sort;
    delete options.limit;
    delete options.skip;
    logger.debug(`Resource get: getting '${resource.name}' document with id '${req.params.id}' with options '${JSON.stringify(options)}'`);
    resource.document.findOne({ _id: req.params.id }, options)
      .then((element) => {
        if (!element) next(new NotFoundResourceError(resource.name, req.params.id));
        else res.status(200).json(element.restFilter());
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a sub resource get endpoint function
 * @function getSubResource
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document sub resource findOne method
 */
function getSubResource(resource) {
  return (req, res, next) => {
    const options = parseQueryParameters(req.query);
    // Only populate option is allowed
    delete options.sort;
    delete options.limit;
    delete options.skip;
    const splittedPath = req.path.split('/');
    const subResource = resource.config.subResourcesMap.get(splittedPath[splittedPath.length - 2]);
    logger.debug(`Sub resource get: getting sub resource '${subResource.name}' with id '${req.params.subId}' of resource '${resource.name}' document with id '${req.params.id}' with options '${JSON.stringify(options)}'`);
    resource.document.findOne({ _id: req.params.id }, { populate: false })
      .then((element) => {
        if (!element) next(new NotFoundResourceError(resource.name, req.params.id));
        else {
          if (!Array.isArray(element[subResource.property])) element[subResource.property] = [element[subResource.property]];
          const subElementIndex = element[subResource.property].indexOf(req.params.subId);
          if (!subElementIndex) next(new NotFoundResourceError(subResource.name, req.params.subId));
          else {
            subResource.document.findOne({ _id: element[subResource.property][subElementIndex] }, options)
              .then(e => res.status(200).json(e.restFilter()))
              .catch(err => next(err));
          }
        }
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a resource post endpoint function
 * @function post
 * @private
 * @param {Object} document - Resource document
 * @returns a function handling call of document creation method
 */
function post(resource) {
  return (req, res, next) => {
    logger.debug(`Resource post: creating '${resource.name}' document with '${JSON.stringify(req.body)}'`);
    resource.document.create(req.body)
      .save()
      .then(element => res.status(201).json(element.restFilter()))
      .catch(err => next(err));
  };
}

/**
 * Creates a sub resource post endpoint function
 * @function postSubResource
 * @private
 * @param {Object} document - Resource document
 * @returns a function handling call of document sub resource creation method
 */
function postSubResource(resource) {
  return (req, res, next) => {
    const subResource = resource.config.subResourcesMap.get(req.path.substr(req.path.lastIndexOf('/') + 1));
    logger.debug(`Sub resource post: creating sub resource '${subResource.name}' of '${resource.name}'with id '${req.params.id}' document with '${JSON.stringify(req.body)}'`);
    resource.document.findOne({ _id: req.params.id }, { populate: false })
      .then((el) => {
        if (!el) next(new NotFoundResourceError(resource.name, req.params.id));
        else {
          subResource.document.create(req.body)
            .save()
            .then((element) => {
              if (el[subResource.property]) el[subResource.property].push(element._id);
              else el[subResource.property] = [element._id];
              el.save()
                .then(() => res.status(200).json(element.restFilter()))
                .catch(err => next(err));
            })
            .catch(err => next(err));
        }
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a resource put endpoint function
 * @function put
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document update method
 */
function put(resource) {
  return (req, res, next) => {
    logger.debug(`Resource put: updating '${resource.name}' document with '${JSON.stringify(req.body)}'`);
    resource.document.findOneAndUpdate({ _id: req.params.id }, req.body)
      .then((ele) => {
        if (!ele) next(new NotFoundResourceError(resource.name, req.params.id));
        else res.status(204).end();
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a sub resource put endpoint function
 * @function putSubResource
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document sub resource update method
 */
function putSubResource(resource) {
  return (req, res, next) => {
    const splittedPath = req.path.split('/');
    const subResource = resource.config.subResourcesMap.get(splittedPath[splittedPath.length - 2]);
    logger.debug(`Sub resource put: updating sub resource '${subResource.name}' with id '${req.params.subId}' of resource '${resource.name}' document with id '${req.params.id}' with '${JSON.stringify(req.body)}'`);
    resource.document.findOne({ _id: req.params.id }, { populate: false })
      .then((element) => {
        if (!element) next(new NotFoundResourceError(resource.name, req.params.id));
        else {
          const subElementIndex = element[subResource.property].indexOf(req.params.subId);
          if (!subElementIndex) next(new NotFoundResourceError(subResource.name, req.params.subId));
          else {
            subResource.document.findOneAndUpdate({ _id: req.params.subId }, req.body)
              .then((ele) => {
                if (!ele) next(new NotFoundResourceError(subResource.name, req.params.subId));
                else res.status(204).end();
              })
              .catch(err => next(err));
          }
        }
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a resource delete endpoint function
 * @function deleteFn
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document delete method
 */
function deleteFn(resource) {
  return (req, res, next) => {
    logger.debug(`Resource delete: deleting '${resource.name}' document with id '${req.params.id}'`);
    resource.document.deleteOne({ _id: req.params.id })
      .then((deleted) => {
        if (deleted === 0) next(new NotFoundResourceError(resource.name, req.params.id));
        else res.status(204).end();
      })
      .catch(err => next(err));
  };
}

/**
 * Creates a sub resource delete endpoint function
 * @function deleteSubResourceFn
 * @private
 * @param {Object} resource - Resource
 * @returns a function handling call of document sub resource delete method
 */
function deleteSubResourceFn(resource) {
  return (req, res, next) => {
    const splittedPath = req.path.split('/');
    const subResource = resource.config.subResourcesMap.get(splittedPath[splittedPath.length - 2]);
    logger.debug(`Sub resource delete: deleting sub resource '${subResource.name}' with id '${req.params.subId}' of resource '${resource.name}' document with id '${req.params.id}'`);
    resource.document.findOne({ _id: req.params.id }, { populate: false })
      .then((element) => {
        if (!element) next(new NotFoundResourceError(resource.name, req.params.id));
        else {
          const subElementIndex = element[subResource.property].indexOf(req.params.subId);
          if (subElementIndex === -1) next(new NotFoundResourceError(subResource.name, req.params.subId));
          else {
            subResource.document.deleteOne({ _id: req.params.subId })
              .then((deleted) => {
                if (deleted === 0) next(new NotFoundResourceError(subResource.name, req.params.subId));
                else {
                  element[subResource.property].splice(subElementIndex, 1);
                  element.save()
                    .then(() => res.status(204).end())
                    .catch(err => next(err));
                }
              })
              .catch(err => next(err));
          }
        }
      })
      .catch(err => next(err));
  };
}

/**
 * Add a configured endpoint to the given router
 * @function addRoute
 * @private
 * @param {string} name       - Resource name
 * @param {Object} config     - Enpoint configuration
 * @param {string} method     - Endpoint http method
 * @param {Object} router     - Express router
 * @param {string} route      - Endpoint route
 * @param {function} callback - Endpoint function
 */
const addRoute = (name, config, method, router, route, callback) => {
  if (config) {
    if (config.protected === true) {
      if (config.roles) {
        if (kindOf(config.roles) === 'array') {
          router[method](route, requiresLogin, requiresRole(config.roles), callback);
        } else throw new TypeError(`Resource config route role must an string[] instead got '${kindOf(config.roles)}'`);
      } else router[method](route, requiresLogin, callback);
    }
  } else router[method](route, callback);
  logger.info(`Resource '${name}': '${method.toUpperCase()} ${route}' route ${(config && config.protected) ? 'protected' : ''} ${(config && config.roles) ? `with roles[${config.roles}]` : ''} created`);
};

/**
 * Creates a new Resource
 * @class
 * @name Resource
 * @param {string} name     - Resource name
 * @param {Object} document - Resource associated document
 * @param {Object} [config] - Resource configuration
 */
class Resource {
  constructor(name, document, config) {
    if (!name) throw new TypeError('No Resource name found');
    if (kindOf(name) !== 'string' || name === '') throw new TypeError('Resource name must be a non empty string');

    /**
     * Resource name
     * @member {string}
     */
    this.name = name;

    if (!document) throw new TypeError('No document associated to the new Resource');
    if (kindOf(document) !== 'function') throw new TypeError('Resource document must be a function');

    /**
     * Resource document
     * @member {function}
     */
    this.document = document;

    /**
     * Resource config
     * @member {Object}
     * @default {}
     */
    this.config = config || {};

    /**
     * Resource router
     * @member {Object}
     */
    this.router = express.Router();

    /** Add of resource routes */
    addRoute(this.name, this.config.global || this.config.list, 'get', this.router, '/', list(this));
    addRoute(this.name, this.config.global || this.config.get, 'get', this.router, '/:id', get(this));
    addRoute(this.name, this.config.global || this.config.post, 'post', this.router, '/', post(this));
    addRoute(this.name, this.config.global || this.config.put, 'put', this.router, '/:id', put(this));
    addRoute(this.name, this.config.global || this.config.delete, 'delete', this.router, '/:id', deleteFn(this));

    if (this.config.subResources && this.config.subResources.length > 0) {
      this.config.subResourcesMap = new Map();
      this.config.subResources.forEach((subResource) => {
        this.config.subResourcesMap.set(subResource.name, subResource);
        addRoute(this.name, this.config.global || this.config.list, 'get', this.router, `/:id/${subResource.name}`, listSubResource(this));
        addRoute(this.name, this.config.global || this.config.get, 'get', this.router, `/:id/${subResource.name}/:subId`, getSubResource(this));
        addRoute(this.name, this.config.global || this.config.post, 'post', this.router, `/:id/${subResource.name}`, postSubResource(this));
        addRoute(this.name, this.config.global || this.config.put, 'put', this.router, `/:id/${subResource.name}/:subId`, putSubResource(this));
        addRoute(this.name, this.config.global || this.config.delete, 'delete', this.router, `/:id/${subResource.name}/:subId`, deleteSubResourceFn(this));
      });
    }

    logger.info(`Resource '${this.name}': created`);
  }
}

module.exports = Resource;
