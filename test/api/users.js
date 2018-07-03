const chai = require('chai');
const chaiHttp = require('chai-http');
const request = require('supertest');
const jsonwebtoken = require('jsonwebtoken');
const User = require('../../backend/models/users');

chai.use(chaiHttp);
const expect = chai.expect;

function compareUser(u1, u2) {
  return u1.login === u2.login &&
    u1._id === u2._id &&
    u1.roles.sort().toString() === u2.roles.sort().toString();
}

function compareNoIdUser(user1, u2) {
  return user1.login === u2.login &&
    user1.roles.sort().toString() === u2.roles.sort().toString();
}

module.exports = (app, config) => {
  describe('User resource integration tests', () => {
    before((done) => {
      app.get('db')
        .dropDatabase()
        .then(() => done());
    });

    after((done) => {
      app.get('db')
        .dropDatabase()
        .then(() => done());
    });

    describe('GET /api/users', () => {
      let user1;
      let user2;
      let accessTokenUser1;
      let accessTokenUser2;

      before((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => {
            user1 = {
              login: 'test1',
              password: 'test1',
              roles: ['USER'],
            };
            accessTokenUser1 = jsonwebtoken.sign({
              login: user1.login,
              roles: user1.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });

            user2 = {
              login: 'test2',
              password: 'test2',
              roles: ['TEST'],
            };
            accessTokenUser2 = jsonwebtoken.sign({
              login: user2.login,
              roles: user2.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });

            Promise.all([
              User.create(user1).save(),
              User.create(user2).save(),
            ]).then((res) => {
              user1._id = res[0]._id;
              user2._id = res[1]._id;
              done();
            });
          });
      });

      after((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => done());
      });

      it('OK: returns a list of users', (done) => {
        request(app)
          .get('/api/users')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('array').to.have.lengthOf(2);
            expect(res.body.some(element => compareUser(element, user1))).to.be.true;
            expect(res.body.some(element => compareUser(element, user2))).to.be.true;
            done();
          });
      });

      it('OK: returns a list of users ordered by login inversed', (done) => {
        request(app)
          .get('/api/users?sort=-login')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('array').to.have.lengthOf(2);
            expect(compareUser(res.body[0], user2)).to.be.true;
            expect(compareUser(res.body[1], user1)).to.be.true;
            done();
          });
      });

      it('OK: returns a list of users ordered by login', (done) => {
        request(app)
          .get('/api/users?sort=login')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('array').to.have.lengthOf(2);
            expect(compareUser(res.body[0], user1)).to.be.true;
            expect(compareUser(res.body[1], user2)).to.be.true;
            done();
          });
      });

      it('OK: returns a list of users with first skipped', (done) => {
        request(app)
          .get('/api/users?sort=login&skip=1')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('array').to.have.lengthOf(1);
            expect(compareUser(res.body[0], user2)).to.be.true;
            done();
          });
      });

      it('OK: returns a list of users limited to 1', (done) => {
        request(app)
          .get('/api/users?sort=login&limit=1')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('array').to.have.lengthOf(1);
            expect(compareUser(res.body[0], user1)).to.be.true;
            done();
          });
      });

      it('ERROR: returns a no token error', (done) => {
        request(app)
          .get('/api/users')
          .end((err, res) => {
            expect(res.statusCode).to.equal(401);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'NO_TOKEN_FOUND');
            expect(res.body).to.have.own.property('message', 'No Jwt token found in authorization header');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a forbidden error (bad role)', (done) => {
        request(app)
          .get('/api/users')
          .set(config.accessTokenHeader, `bearer ${accessTokenUser2}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(403);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'FORBIDDEN_OPERATION');
            expect(res.body).to.have.own.property('message', 'Forbidden');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });
    });

    describe('GET /api/users/:id', () => {
      let user1;
      let user2;
      let accessTokenUser1;
      let accessTokenUser2;

      before((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => {
            user1 = {
              login: 'test1',
              password: 'test1',
              roles: ['USER'],
            };
            accessTokenUser1 = jsonwebtoken.sign({
              login: user1.login,
              roles: user1.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });
            user2 = {
              login: 'test2',
              password: 'test2',
              roles: ['TEST'],
            };
            accessTokenUser2 = jsonwebtoken.sign({
              login: user2.login,
              roles: user2.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });

            Promise.all([
              User.create(user1).save(),
              User.create(user2).save(),
            ]).then((res) => {
              user1._id = res[0]._id;
              user2._id = res[1]._id;
              done();
            });
          });
      });

      after((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => done());
      });

      it('OK: returns a user by id', (done) => {
        request(app)
          .get(`/api/users/${user2._id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(200);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(compareUser(res.body, user2)).to.be.true;
            done();
          });
      });

      it('ERROR: returns a not found resource error', (done) => {
        const id = 'test';
        request(app)
          .get(`/api/users/${id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(404);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'RESOURCE_NOT_FOUND');
            expect(res.body).to.have.own.property('message', `No resource 'users' found with id '${id}'`);
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a no token error', (done) => {
        request(app)
          .get(`/api/users/${user1._id}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(401);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'NO_TOKEN_FOUND');
            expect(res.body).to.have.own.property('message', 'No Jwt token found in authorization header');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a forbidden error (bad role)', (done) => {
        request(app)
          .get(`/api/users/${user1._id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser2}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(403);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'FORBIDDEN_OPERATION');
            expect(res.body).to.have.own.property('message', 'Forbidden');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });
    });

    describe('POST /api/users', () => {
      let user1;
      let user2;
      let user3;
      let accessTokenUser1;
      let accessTokenUser2;

      before((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => {
            user1 = {
              login: 'test1',
              password: 'test1',
              roles: ['USER'],
            };
            accessTokenUser1 = jsonwebtoken.sign({
              login: user1.login,
              roles: user1.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });
            user2 = {
              login: 'test2',
              password: 'test2',
              roles: ['TEST'],
            };
            accessTokenUser2 = jsonwebtoken.sign({
              login: user2.login,
              roles: user2.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });
            user3 = {
              login: 'test3',
              password: 'test3',
              roles: ['TEST'],
            };

            Promise.all([
              User.create(user1).save(),
              User.create(user2).save(),
            ]).then((res) => {
              user1._id = res[0]._id;
              user2._id = res[1]._id;
              done();
            });
          });
      });

      after((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => done());
      });

      it('OK: creates a new user', (done) => {
        request(app)
          .post('/api/users')
          .send(user3)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(201);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(compareNoIdUser(res.body, user3)).to.be.true;
            expect(res.body).to.have.own.property('_id');
            done();
          });
      });

      it('ERROR: returns a no token error', (done) => {
        request(app)
          .post('/api/users')
          .send(user3)
          .end((err, res) => {
            expect(res.statusCode).to.equal(401);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'NO_TOKEN_FOUND');
            expect(res.body).to.have.own.property('message', 'No Jwt token found in authorization header');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a forbidden error (bad role)', (done) => {
        request(app)
          .post('/api/users')
          .send(user3)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser2}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(403);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'FORBIDDEN_OPERATION');
            expect(res.body).to.have.own.property('message', 'Forbidden');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      // it('ERROR: returns an internal error for non unicity on login key', (done) => {
      //   request(app)
      //     .post('/api/users')
      //     .send(user3)
      //     .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
      //     .end((err, res) => {
      //       expect(res.statusCode).to.equal(500);
      //       expect(res).to.be.json;
      //       expect(res.body).to.be.an('object');
      //       expect(res.body).to.have.own.property('code', 'INTERNAL_SERVER_ERROR');
      //       expect(res.body).to.have.own.property('message', 'Can\'t insert key test2, it violates the unique constraint');
      //       expect(res.body).to.have.own.property('reqId');
      //       done();
      //     });
      // });
    });

    describe('PUT /api/users/:id', () => {
      let user1;
      let user2;
      let user3;
      let accessTokenUser1;
      let accessTokenUser3;

      before((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => {
            user1 = {
              login: 'test1',
              password: 'test1',
              roles: ['USER'],
            };
            accessTokenUser1 = jsonwebtoken.sign({
              login: user1.login,
              roles: user1.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });
            user2 = {
              login: 'test2',
              password: 'test2',
              roles: ['TEST'],
            };
            user3 = {
              login: 'test3',
              password: 'test3',
              roles: ['TEST'],
            };
            accessTokenUser3 = jsonwebtoken.sign({
              login: user3.login,
              roles: user3.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });

            Promise.all([
              User.create(user1).save(),
              User.create(user2).save(),
              User.create(user3).save(),
            ]).then((res) => {
              user1._id = res[0]._id;
              user2._id = res[1]._id;
              user3._id = res[2]._id;
              done();
            });
          });
      });

      after((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => done());
      });

      it('OK: updates a user', (done) => {
        const newLogin = 'test2-new';
        request(app)
          .put(`/api/users/${user2._id}`)
          .send({ login: newLogin })
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(204);
            User.findOne({ _id: user2._id })
              .then((user) => {
                expect(user.login).to.be.equal(newLogin);
                done();
              });
          });
      });

      it('ERROR: returns a no token error', (done) => {
        request(app)
          .put(`/api/users/${user2._id}`)
          .send({})
          .end((err, res) => {
            expect(res.statusCode).to.equal(401);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'NO_TOKEN_FOUND');
            expect(res.body).to.have.own.property('message', 'No Jwt token found in authorization header');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a forbidden error (bad role)', (done) => {
        request(app)
          .put(`/api/users/${user2._id}`)
          .send({})
          .set(config.accessTokenHeader, `bearer ${accessTokenUser3}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(403);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'FORBIDDEN_OPERATION');
            expect(res.body).to.have.own.property('message', 'Forbidden');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      // it('ERROR: returns an internal error for non unicity on login key', (done) => {
      //   request(app)
      //     .put(`/api/users/${user3._id}`)
      //     .send({ login: user1.login })
      //     .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
      //     .end((err, res) => {
      //       expect(res.statusCode).to.equal(500);
      //       expect(res).to.be.json;
      //       expect(res.body).to.be.an('object');
      //       expect(res.body).to.have.own.property('code', 'INTERNAL_SERVER_ERROR');
      //       expect(res.body).to.have.own.property('message', 'Can\'t insert key test1, it violates the unique constraint');
      //       expect(res.body).to.have.own.property('reqId');
      //       done();
      //     });
      // });
    });

    describe('DELETE /api/users/:id', () => {
      let user1;
      let user2;
      let user3;
      let accessTokenUser1;
      let accessTokenUser3;

      before((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => {
            user1 = {
              login: 'test1',
              password: 'test1',
              roles: ['USER'],
            };
            accessTokenUser1 = jsonwebtoken.sign({
              login: user1.login,
              roles: user1.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });
            user2 = {
              login: 'test2',
              password: 'test2',
              roles: ['TEST'],
            };
            user3 = {
              login: 'test3',
              password: 'test3',
              roles: ['TEST'],
            };
            accessTokenUser3 = jsonwebtoken.sign({
              login: user3.login,
              roles: user3.roles,
            }, config.tokenSecretKey, { expiresIn: config.accessTokenExpirationTime });

            Promise.all([
              User.create(user1).save(),
              User.create(user2).save(),
              User.create(user3).save(),
            ]).then((res) => {
              user1._id = res[0]._id;
              user2._id = res[1]._id;
              user3._id = res[2]._id;
              done();
            });
          });
      });

      after((done) => {
        app.get('db')
          .dropDatabase()
          .then(() => done());
      });

      it('OK: deletes a user', (done) => {
        request(app)
          .delete(`/api/users/${user2._id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(204);
            User.findOne({ _id: user2._id })
              .then((user) => {
                expect(user).to.be.null;
                done();
              });
          });
      });

      it('ERROR: returns a no token error', (done) => {
        request(app)
          .delete(`/api/users/${user2._id}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(401);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'NO_TOKEN_FOUND');
            expect(res.body).to.have.own.property('message', 'No Jwt token found in authorization header');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a forbidden error (bad role)', (done) => {
        request(app)
          .delete(`/api/users/${user2._id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser3}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(403);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'FORBIDDEN_OPERATION');
            expect(res.body).to.have.own.property('message', 'Forbidden');
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });

      it('ERROR: returns a not found resource error', (done) => {
        const id = 'test';
        request(app)
          .delete(`/api/users/${id}`)
          .set(config.accessTokenHeader, `bearer ${accessTokenUser1}`)
          .end((err, res) => {
            expect(res.statusCode).to.equal(404);
            expect(res).to.be.json;
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.own.property('code', 'RESOURCE_NOT_FOUND');
            expect(res.body).to.have.own.property('message', `No resource 'users' found with id '${id}'`);
            expect(res.body).to.have.own.property('reqId');
            done();
          });
      });
    });
  });
};
