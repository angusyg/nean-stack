const chai = require('chai');
const sinon = require('sinon');
const camo = require('camo');
const psp = require('passport');
const jwt = require('jsonwebtoken');
const { apiCfg } = require('../config');
const User = require('../models/users');
const passport = require('./passport');
const { UnauthorizedAccessError, JwtTokenExpiredError, NoJwtTokenError, JwtTokenSignatureError } = require('../models/errors');


const expect = chai.expect;

describe('Module helpers/passport', () => {
  it('should export initialize function', (done) => {
    expect(passport).to.have.own.property('initialize').to.be.a('function');
    done();
  });

  it('should export authenticate function', (done) => {
    expect(passport).to.have.own.property('authenticate').to.be.a('function');
    done();
  });

  describe('Unit tests', () => {
    const accessToken = jwt.sign({
      login: 'test',
      roles: ['USER'],
    }, apiCfg.tokenSecretKey, { expiresIn: apiCfg.accessTokenExpirationTime });
    const accessTokenExpired = jwt.sign({
      login: 'test',
      roles: ['USER'],
    }, apiCfg.tokenSecretKey, { expiresIn: 0 });
    const accessTokenBadSignature = jwt.sign({
      login: 'test',
      roles: ['USER'],
    }, 'SECRET', { expiresIn: apiCfg.accessTokenExpirationTime });
    const accessTokenUserNotFound = jwt.sign({
      login: 'test1',
      roles: ['USER'],
    }, apiCfg.tokenSecretKey, { expiresIn: apiCfg.accessTokenExpirationTime });
    const req = { headers: { authorization: '' } };
    const res = {};
    let next = () => true;
    let initializeStub;
    let database;

    before((done) => {
      camo.connect('nedb://memory')
        .then((db) => {
          database = db;
          done();
        });
    });

    beforeEach((done) => {
      initializeStub = sinon.spy(psp, 'initialize');
      next = sinon.stub();
      User.create({
          login: 'test',
          password: 'test',
          roles: ['USER'],
        })
        .save()
        .then(() => done());
    });

    afterEach((done) => {
      initializeStub.restore();
      database.dropDatabase()
        .then(() => done());
    });

    after((done) => {
      database.dropDatabase()
        .then(() => done());
    });

    it('initialize(): should initialize passport', (done) => {
      passport.initialize();
      expect(initializeStub.withArgs().calledOnce).to.be.true;
      done();
    });

    it('authenticate(req: Request, res: Response, next: function): should call passport authenticate and put user in request', (done) => {
      req.headers.authorization = `bearer ${accessToken}`;
      passport.authenticate(req, res, next);
      setTimeout(() => {
        expect(req).to.have.own.property('user').to.deep.include({ login: 'test', roles: ['USER'] });
        expect(next.withArgs().calledOnce).to.be.true;
        done();
      }, 100);
    });

    it('authenticate(req: Request, res: Response, next: function): should call passport authenticate and call next with JwtTokenExpiredError', (done) => {
      req.headers.authorization = `bearer ${accessTokenExpired}`;
      passport.authenticate(req, res, next);
      setTimeout(() => {
        expect(next.calledOnce).to.be.true;
        expect(next.getCall(0).args[0]).to.be.instanceof(JwtTokenExpiredError);
        done();
      }, 100);
    });

    it('authenticate(req: Request, res: Response, next: function): should call passport authenticate and call next with JwtTokenSignatureError', (done) => {
      req.headers.authorization = `bearer ${accessTokenBadSignature}`;
      passport.authenticate(req, res, next);
      setTimeout(() => {
        expect(next.calledOnce).to.be.true;
        expect(next.getCall(0).args[0]).to.be.instanceof(JwtTokenSignatureError);
        done();
      }, 100);
    });

    it('authenticate(req: Request, res: Response, next: function): should call passport authenticate and call next with NoJwtTokenError', (done) => {
      req.headers.authorization = 'bearer ';
      passport.authenticate(req, res, next);
      setTimeout(() => {
        expect(next.calledOnce).to.be.true;
        expect(next.getCall(0).args[0]).to.be.instanceof(NoJwtTokenError);
        done();
      }, 100);
    });

    it('authenticate(req: Request, res: Response, next: function): should call passport authenticate and call next with UnauthorizedAccessError because user does not exist', (done) => {
      req.headers.authorization = `bearer ${accessTokenUserNotFound}`;
      passport.authenticate(req, res, next);
      setTimeout(() => {
        expect(next.calledOnce).to.be.true;
        expect(next.getCall(0).args[0]).to.be.instanceof(UnauthorizedAccessError);
        expect(next.getCall(0).args[0]).to.have.own.property('code', 'USER_NOT_FOUND');
        expect(next.getCall(0).args[0]).to.have.own.property('message', 'No user found for login in JWT Token');
        done();
      }, 100);
    });
  });
});
