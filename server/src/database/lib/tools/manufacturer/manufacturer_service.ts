import Manufacturer from './manufacturer_model';

async function listAll() {
  return Manufacturer.find();
}
export default {
  listAll,
};
