/**
 * @fileoverview Rest resource document class module
 * @module models/restdocument
 * @requires {@link external:camo}
 */

const { Document } = require('camo');

/**
 * Creates a RestDocument
 * @class
 * @extends external:camo.Document
 * @name RestDocument
 */
class RestDocument extends Document {
  constructor() {
    super();
  }

  /**
   * Filters private property(ies) for REST result
   * @method restFilter
   */
  restFilter() {
    return this;
  }
}

module.exports = RestDocument;
