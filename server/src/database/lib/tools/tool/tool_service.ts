import Tool from './tool_model';

async function search(itemNumber: string) {
  return Tool.find({ item: itemNumber });
}
export default {
  search,
};
