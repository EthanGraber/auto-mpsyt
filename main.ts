import { argv } from 'node:process';
import { spawn } from 'child_process';
import { exec } from 'node:child_process';

const treeKill = require('tree-kill');

const file_names = argv.slice(2);
const cat = spawn('cat', file_names);
const urls: string[] = [];

cat.stdout.on('data', (data) => {
  urls.push(...data.toString('utf8').split('\n'));
  urls.pop();
});

cat.on('close', (code) => {
  console.log(`cat process exited with code ${code}`);
  if (code != 0) throw Error('bad input');
  add_to_mpd(urls, 0);
});

const add_to_mpd = (url_list: string[], attempt_num: number) => {
  if (attempt_num >= 3) {
    console.log('The following URLs failed > 3 times:');
    console.log(url_list);
    return;
  }

  exec(`rm ${process.env.HOME}/.config/mps-youtube/cache_py_3.10.`);

  const retry_urls: string[] = [];
  const promises: Promise<void>[] = [];

  url_list.forEach((url) => {
    const mpsyt = spawn('mpsyt', ['playurl', url]);

    const promise = new Promise<void>((resolve) => {
      mpsyt.stdout.on('data', (data) => {
        if (data.includes('Problem playing last item:')) {
          retry_urls.push(mpsyt.spawnargs[2]);
          console.log('attempting to kill pid:', mpsyt.pid);
          treeKill(mpsyt.pid);
          resolve();
        }
      });

      mpsyt.on('close', () => {
        resolve();
      });
    });

    promises.push(promise);
  });

  Promise.allSettled(promises).then(() => {
    if (retry_urls.length > 0) {
      console.log('retrying the following urls:');
      console.log(retry_urls);
      add_to_mpd(retry_urls, ++attempt_num);
    } else {
      console.log('done');
    }
  });
};
