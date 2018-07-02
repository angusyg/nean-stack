process.env.DB_FOLDER = 'memory';
process.env.TOKEN_SECRET = 'TOKEN_SECRET';

const { apiCfg } = require('../backend/config');
const app = require('../backend/app');
const baseTI = require('./api/base');
const usersTI = require('./api/users');

describe('API integration tests', () => {
  let server;

  before((done) => {
    app.on('appStarted', () => done());
    server = require('../backend/bin/www'); // eslint-disable-line global-require
  });

  after(done => server.close(() => done()));

  describe('Integration tests', () => {
    baseTI(app, apiCfg);
    usersTI(app, apiCfg);
  });
});
