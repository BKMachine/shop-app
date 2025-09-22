const focas_mappings: FocasMapping = {
  sweep: {
    'state.data.online': 'online',
  },
  'production/1': {
    'state.data.program.selected.name': 'mainProgram',
    'state.data.program.selected.comment': 'mainComment',
    'state.data.program.current.name': 'runningProgram',
    'state.data.program.current.comment': 'runningComment',
    'state.data.timers.cycle_time_ms': 'cycle',
  },
  'state/1': {
    'state.data.mode': 'mode',
    'state.data.execution': 'execution',
  },
  'state/2': {
    'state.data.mode': 'mode2',
    'state.data.execution': 'execution2',
  },
  'alarms/1': {
    'state.data.alarms': 'alarms',
  },
  'alarms/2': {
    'state.data.alarms': 'alarms2',
  },
  'macro/1': {
    'state.data.macro_timer.value': 'macro_timer',
  },
};

export default focas_mappings;
