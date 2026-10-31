import { runEvalCommand } from './eval-command.js';

runEvalCommand(process.argv.slice(2), console).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
