const chai = require('chai');
const RestDocument = require('./restdocument');

const expect = chai.expect;

describe('Module models/restdocument', () => {
  it('should export RestDocument', (done) => {
    expect(RestDocument).to.be.a('function');
    done();
  });

  describe('Unit tests', () => {
    it('should have a restFilter function', (done) => {
      const restDocument = new RestDocument();
      expect(restDocument.restFilter).to.be.a('function');
      done();
    });

    it('should have a restFilter function returning self', (done) => {
      const restDocument = new RestDocument();
      expect(restDocument.restFilter()).to.be.equal(restDocument);
      done();
    });
  });
});
