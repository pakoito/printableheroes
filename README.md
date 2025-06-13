# Printable Heroes Downloader

Printable Heroes Downloader is a Node.js tool for batch-downloading printable hero miniatures from printableheroes.com. It automates fetching assets by their IDs, supports filtering by tier, and allows parallel downloads for efficiency. The script requires your personal Authorization header to access files and can be integrated into automated workflows to keep your collection up to date.

### Usage

`yarn start --folder <output folder> --secret <Authorization header>`

or

`node ./index.js --folder <output folder> --secret <Authorization header>`

### Optional parameters
```
--tier <max tier to download. Default: 10>

--from_id <first id to download. Default: 0>

--parallel <max parallel downloads. Default: 5>

--progress <add this to show a progress bar in terminal. Default: off>
```

## Authorization header

Find your secret in the Authorization header on any printableheroes website download request.

Find the asset ids on the urls such as `https://printableheroes.com/minis/<id>`

## Get the latest heroes

This bash command will extract the highest id in your printableheroes folder and download any hero with a higher id. Great to put in a cronjob.

`node <path/to/repo>/printableheroes/index.js --tier <tier> --folder <path/to/downloads> --progress --secret <Authorization header> --from_id $(expr 1 + $(ls <path/to/downloads> | cut -d\( -f2 | cut -d\) -f1 | grep -e "^[0-9]\+" | sort -r | head -n1))`
