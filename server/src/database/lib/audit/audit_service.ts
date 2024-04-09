import Audit from './audit_model';
import _ from 'lodash';

async function addToolAudit(oldTool: ToolDoc | null, newTool: ToolDoc) {
  const doc = new Audit({
    type: 'tool',
    timestamp: new Date(),
    old: oldTool,
    new: newTool,
  });
  await doc.save();
}

async function getToolDifferences() {
  const tools = await Audit.find();
  const results = [];
  tools.forEach((x) => {
    const diff = _.reduce(
      x.old,
      function (result, value, key) {
        return _.isEqual(value, x.new[key]) ? result : result.concat(key);
      },
      [],
    );
    results.push(diff);
  });
  console.log(results);
}

export default {
  addToolAudit,
  getToolDifferences,
};
