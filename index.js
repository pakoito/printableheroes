import minimist from 'minimist';
import got from 'got';
import download from 'download';
import pLimit from 'p-limit';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';


/**
 * Downloads all files for a single miniature ID across various tiers.
 * @param {function} limit - The p-limit instance to control concurrency.
 * @param {string} secret - The authorization token.
 * @param {number} maxTier - The maximum Patreon tier to download files for.
 * @param {string} folder - The destination folder for the downloaded files.
 * @param {string} id - The ID of the miniature to download.
 * @returns {Promise<Array>} A promise that resolves to an array of any errors that occurred.
 */
async function downloadId(limit, secret, maxTier, folder, id) {
    // Create the directory for the mini if it doesn't exist
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, {
            recursive: true
        });
    }

    const result = await got.get(`https://api.printableheroes.com/api/minifiles/get?miniId=${id}`, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        // Handle potential JSON parsing errors
        responseType: 'json'
    });

    const body = result.body;

    // Flatten all files from tiers up to the maxTier
    const filesToDownload = Object.entries(body)
        .filter(([tier, _]) => tier <= maxTier)
        .flatMap(([tier, files]) =>
            files.map(fileInfo => ({ ...fileInfo, tier }))
        );

    // Download files concurrently using the provided limit
    const errors = await Promise.all(
        filesToDownload.map(({
            FileName,
            tier
        }) =>
            limit(async () => {
                try {
                    await download(
                        `https://api.printableheroes.com/files?mini_id=${id}&tier=${tier}&file_name=${FileName}`,
                        folder, {
                            headers: {
                                Authorization: secret,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
                            }
                        }
                    );
                    return null; // Return null on success
                } catch (e) {
                    // Return detailed error information on failure
                    return {
                        id,
                        tier,
                        file: FileName,
                        // Provide a more readable error message
                        error: e.message || JSON.stringify(e)
                    };
                }
            })
        )
    );

    // Filter out nulls to return only the errors
    return errors.filter(e => e !== null);
}


/**
 * Main execution function.
 */
async function main() {
    const {
        tier,
        folder,
        secret,
        from_id,
        parallel
    } = minimist(process.argv.slice(2));

    // Assert that required arguments are provided
    assert(folder, `Required arg: --folder <path>`);
    assert(secret, `Required arg: --secret <token>. Look for the Authorization header in a download request.`);

    // Set default values for optional arguments
    const maxTier = tier ?? 10;
    const minId = from_id ?? 0;
    const concurrency = parallel ?? 5;

    // Fetch the list of all miniatures
    const result = await got.get(`https://api.printableheroes.com/api/minis/getAll`, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        responseType: 'json'
    });

    const limit = pLimit(concurrency);
    const ids = result.body
        .filter(({
            Id
        }) => Id >= minId)
        .map(({
            Name,
            Id
        }) => [
            // Sanitize the name to make it a valid folder name
            Name.trim().replace(/[<>:"/\\|?*]/g, '_'),
            Id.toString().trim()
        ])
        .sort((a, b) => a[1] - b[1]);

    if (ids.length === 0) {
        console.log(`No new heroes found since ID ${minId}.`);
        return;
    }

    console.log(`Found ${ids.length} new heroes. Starting download...`);

    let completedCount = 0;
    const totalCount = ids.length;

    /**
     * Updates the progress bar in the console.
     */
    const updateConsoleProgress = () => {
        const percentage = Math.floor((completedCount / totalCount) * 100);
        const barLength = 40;
        const filledLength = Math.round(barLength * (completedCount / totalCount));
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        // Use \r to move the cursor to the beginning of the line, allowing us to overwrite it
        process.stdout.write(`Progress: [${bar}] ${completedCount}/${totalCount} (${percentage}%) \r`);
    };

    // Initial progress bar display
    updateConsoleProgress();

    // Map each ID to a download promise and wait for all to complete
    const errors = await Promise.all(ids.map(async ([name, id]) => {
        // Construct the full path for the specific miniature's folder
        const miniFolder = path.join(folder, `${name} (${id})`);
        const result = await downloadId(limit, secret, maxTier, miniFolder, id);
        completedCount++;
        updateConsoleProgress(); // Update the progress bar after each hero is processed
        return result;
    }));

    // Print a newline to move past the progress bar line upon completion
    process.stdout.write('\n');
    console.log('Download process finished.');

    const errors_flat = errors.flat();
    if (errors_flat.length > 0) {
        console.log(`\nEncountered ${errors_flat.length} failed downloads:`);
        console.log(JSON.stringify(errors_flat, null, 2));
    } else {
        console.log('All files downloaded successfully!');
    }
}

// Run the main function and catch any top-level errors
main().catch(err => {
    console.error(`\nAn unexpected error occurred: ${err.message}`);
    // console.error(err.stack); // Uncomment for more detailed debugging
});