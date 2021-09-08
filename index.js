import minimist from 'minimist';
import got from 'got';
import download from 'download';
import pLimit from 'p-limit';
import assert from 'assert/strict';

async function downloadId(limit, secret, maxTier, folder, id) {
  const result = await got.get(`https://api.printableheroes.com/api/minifiles/get?miniId=${id}`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
  const body = JSON.parse(result.body);
  const errors = await Promise.all(Object.entries(body)
    .filter(([tier, _]) => tier <= maxTier)
    .flatMap(([tier, files]) =>
      files.map(({ FileName }) =>
        limit(async () => {
          try {
            await download(
              `https://api.printableheroes.com/files?mini_id=${id}&tier=${tier}&file_name=${FileName}`,
              folder,
              {
                headers: {
                  Authorization: secret,
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
                }
              }
            );
            return [];
          } catch (e) {
            return [{ id, tier, file: FileName, error: JSON.stringify(e) }];
          }
        })
      )
    ));
  return errors.flatMap((a) => a);
}

async function main() {
  const { tier, folder, secret, from_id, parallel } = minimist(process.argv.slice(2));
  assert(folder, `Required arg: folder`);
  assert(secret, `Required arg: secret. Look for the Authorization header in a download request`);
  const maxTier = tier ?? 10;
  const minId = from_id ?? 0;
  const result = await got.get(`https://api.printableheroes.com/api/minis/getAll`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
  const limit = pLimit(parallel ?? 5);
  const ids = JSON.parse(result.body).filter(({ Id }) => Id >= minId).map(({ Name, Id }) => [Name.trim(), Id.toString().trim()]).sort((a, b) => a[1] - b[1]);
  console.log(ids.length === 0 ? `No new heroes since {${minId}}` : `Downloading {${ids.length}} heroes: ${JSON.stringify(ids.map(([name, id]) => `[${id}] ${name}`), undefined, 2)}`);
  const errors = await Promise.all(ids.map(([name, id]) => downloadId(limit, secret, maxTier, `${folder}/${name} (${id})`, id)));
  const errors_flat = errors.flatMap((a) => a);
  ids.length === 0 || errors_flat.length == 0 ? void 0 : console.log(`Failed {${errors_flat.length}} downloads: ${JSON.stringify(errors_flat, undefined, 2)}`);
}

main();
