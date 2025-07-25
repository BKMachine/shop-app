const Service = require('node-windows').Service;

const svc = new Service({
  name: 'DYMO Wireless Printer',
  script: 'C:\\shop-app\\printer\\index.mjs',
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', () => {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

// Uninstall the service.
svc.uninstall();
