const chai = require('chai');
const camo = require('camo');
const util = require('util');
const proxyquire = require('proxyquire');
const jsonwebtoken = require('jsonwebtoken');
const User = require('../models/users');
const { apiCfg } = require('../config');
const { ApiError, UnauthorizedAccessError } = require('../models/errors');

const refreshToken = '00000000-0000-0000-0000-000000000000';
const users = proxyquire('./users', { 'uuid/v4': () => refreshToken });
const jwtVerify = util.promisify(jsonwebtoken.verify);
const expect = chai.expect;

describe('Module services/users', () => {
  it('should export login function', (done) => {
    expect(users).to.have.own.property('login').to.be.a('function');
    done();
  });

  it('should export refreshToken function', (done) => {
    expect(users).to.have.own.property('refreshToken').to.be.a('function');
    done();
  });

  describe('Unit tests', () => {
    let database;
    before((done) => {
      camo.connect('nedb://memory')
        .then((db) => {
          database = db;
          done();
        });
    });

    beforeEach((done) => {
      Promise.all([
          User.create({
            login: 'test',
            password: 'test',
            roles: ['USER'],
          })
          .save(),
          User.create({
            login: 'test2',
            password: 'test',
            roles: ['USER'],
            refreshToken,
          })
          .save(),
        ])
        .then(() => done());
    });

    afterEach((done) => {
      database.dropDatabase()
        .then(() => done());
    });

    after((done) => {
      database.dropDatabase()
        .then(() => done());
    });

    it('login(infos: Object): should connect user besides infos and update refreshToken in database', (done) => {
      const infos = {
        login: 'test',
        password: 'test',
      };
      users.login(infos)
        .then((tokens) => {
          expect(tokens).to.be.an('object');
          expect(tokens).to.have.own.property('refreshToken', refreshToken);
          expect(tokens).to.have.own.property('accessToken');
          jwtVerify(tokens.accessToken, apiCfg.tokenSecretKey)
            .then(() => {
              User.findOne({ login: infos.login })
                .then((user) => {
                  expect(user).to.have.own.property('refreshToken', refreshToken);
                  done();
                })
                .catch(err => done(err));
            })
            .catch(err => done(err));
        })
        .catch(err => done(err));
    });

    it('login(infos: Object): should reject with a Bad login UnauthorizedAccessError', (done) => {
      const infos = {
        login: 'test1',
        password: 'test',
      };
      users.login(infos)
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err).to.be.an.instanceof(ApiError);
          expect(err).to.be.an.instanceof(UnauthorizedAccessError);
          expect(err).to.have.own.property('name', 'UnauthorizedAccessError');
          expect(err).to.have.own.property('statusCode', 401);
          expect(err).to.have.own.property('code', 'BAD_LOGIN');
          expect(err).to.have.own.property('message', 'Bad login');
          done();
        });
    });

    it('login(infos: Object): should reject with a Bad password UnauthorizedAccessError', (done) => {
      const infos = {
        login: 'test',
        password: 'test1',
      };
      users.login(infos)
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err).to.be.an.instanceof(ApiError);
          expect(err).to.be.an.instanceof(UnauthorizedAccessError);
          expect(err).to.have.own.property('name', 'UnauthorizedAccessError');
          expect(err).to.have.own.property('statusCode', 401);
          expect(err).to.have.own.property('code', 'BAD_PASSWORD');
          expect(err).to.have.own.property('message', 'Bad password');
          done();
        });
    });

    it('refreshToken(user: Object, refreshToken: string): should returns a new access Jwt token', () => users.refreshToken({ login: 'test2' }, refreshToken)
      .then((token) => {
        expect(token).to.be.an('object');
        expect(token).to.have.own.property('accessToken');
        return expect(jwtVerify(token.accessToken, apiCfg.tokenSecretKey)).to.be.fulfilled;
      }));

    it('refreshToken(user: Object, refreshToken: string): should reject with an UnauthorizedAccessError for missing refresh token', (done) => {
      users.refreshToken({ login: 'test' })
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err).to.be.an.instanceof(ApiError);
          expect(err).to.be.an.instanceof(UnauthorizedAccessError);
          expect(err).to.have.own.property('name', 'UnauthorizedAccessError');
          expect(err).to.have.own.property('statusCode', 401);
          expect(err).to.have.own.property('code', 'MISSING_REFRESH_TOKEN');
          expect(err).to.have.own.property('message', 'Refresh token\'s missing');
          done();
        });
    });

    it('refreshToken(user: Object, refreshToken: string): should reject with an UnauthorizedAccessError for revoked/bad refresh token', (done) => {
      users.refreshToken({ login: 'test' }, refreshToken)
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err).to.be.an.instanceof(ApiError);
          expect(err).to.be.an.instanceof(UnauthorizedAccessError);
          expect(err).to.have.own.property('name', 'UnauthorizedAccessError');
          expect(err).to.have.own.property('statusCode', 401);
          expect(err).to.have.own.property('code', 'REFRESH_NOT_ALLOWED');
          expect(err).to.have.own.property('message', 'Refresh token has been revoked');
          done();
        });
    });

    it('refreshToken(user: Object, refreshToken: string): should reject with an UnauthorizedAccessError for user not being found', (done) => {
      users.refreshToken({ login: 'test3' }, refreshToken)
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err).to.be.an.instanceof(ApiError);
          expect(err).to.have.own.property('name', 'ApiError');
          expect(err).to.have.own.property('statusCode', 500);
          expect(err).to.have.own.property('code', 'USER_NOT_FOUND');
          expect(err).to.have.own.property('message', 'No user found for login in JWT Token');
          done();
        });
    });
  });
});
