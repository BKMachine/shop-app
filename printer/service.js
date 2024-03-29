const Service = require('node-windows').Service;

const svc = new Service({
  name: 'DYMO Wireless Printer',
  description:
    'A simple proxy to forward print requests to localhost as the DYMO Connect service only listens on localhost.',
  script: 'C:\\shop-app\\printer\\index.mjs',
  nodeOptions: [],
  env: [
    {
      name: 'PORT',
      value: 3000,
    },
  ],
});

svc.on('install', function () {
  svc.start();
});

svc.install();
