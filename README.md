# Usage

`yarn start --folder <output folder> --secret <Authorization header>`

### Optional parameters
```
--tier <max tier to download. Default: 10>

--from_id <first id to download. Default: 0>

--parallel <max parallel downloads. Default: 5>
```

## Authorization header

Find your secret in the Authorization header on any printableheroes website download request.

Find the asset ids on the urls such as `https://printableheroes.com/minis/<id>`

## Get the latest heroes

This bash command will extract the highest id in your printableheroes folder and download any hero with a higher id. Great to put in a cronjob.

`node <path/to/repo>/printableheroes/index.js --tier <tier> --folder <path/to/downloads> --secret <Authorization header> --from_id $(expr 1 + $(ls <path/to/downloads> | cut -d\( -f2 | cut -d\) -f1 | grep -e "^[0-9]\+" | sort -r | head -n1))`
