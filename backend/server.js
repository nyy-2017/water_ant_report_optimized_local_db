const { app, config } = require('./src/app');

app.listen(config.port, () => console.log('API listening on ' + config.port));
