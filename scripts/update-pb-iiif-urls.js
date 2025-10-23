#!/usr/bin/env node

/**
 * Script to update <pb> elements' facs attributes with IIIF URLs
 * from corresponding <graphic> elements in TEI XML files
 *
 * Usage: node update-pb-iiif-urls.js <directory>
 * Example: node update-pb-iiif-urls.js evt-viewer/app/data/busta-10
 */

const fs = require('fs');
const path = require('path');

// Mapping of page labels to graphic elements
// e.g., "1r" -> "1 - Recto", "1v" -> "1 - Verso"
function normalizePageLabel(label) {
    return label.toLowerCase().trim();
}

function extractPageNumber(nAttribute) {
    // Extract page number from "1 - Recto" -> "1r", "2 - Verso" -> "2v"
    const match = nAttribute.match(/(\d+)\s*-\s*(Recto|Verso)/i);
    if (match) {
        const num = match[1];
        const side = match[2].toLowerCase() === 'recto' ? 'r' : 'v';
        return num + side;
    }
    return null;
}

function updateXMLFile(filePath) {
    console.log(`\nProcessing: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract all <graphic> elements with their n and url attributes
    const graphicMap = {};
    const graphicRegex = /<graphic[^>]+n="([^"]+)"[^>]+url="([^"]+)"/g;
    let match;

    while ((match = graphicRegex.exec(content)) !== null) {
        const pageLabel = normalizePageLabel(match[1]);
        const url = match[2];
        graphicMap[pageLabel] = url;
        console.log(`  Found graphic: ${match[1]} -> ${url}`);
    }

    if (Object.keys(graphicMap).length === 0) {
        console.log(`  No <graphic> elements found, skipping.`);
        return false;
    }

    // Find and update all <pb> elements
    let updated = false;
    const pbRegex = /<pb([^>]+)>/g;

    content = content.replace(pbRegex, (fullMatch, attributes) => {
        // Extract n and facs attributes
        const nMatch = attributes.match(/n="([^"]+)"/);
        const facsMatch = attributes.match(/facs="([^"]+)"/);

        if (!nMatch || !facsMatch) {
            return fullMatch; // No n or facs attribute, skip
        }

        const nValue = nMatch[1];
        const currentFacs = facsMatch[1];
        const pageLabel = extractPageNumber(nValue);

        if (!pageLabel) {
            console.log(`  Could not extract page label from: ${nValue}`);
            return fullMatch;
        }

        const normalizedLabel = normalizePageLabel(pageLabel);
        const iiifUrl = graphicMap[normalizedLabel];

        if (iiifUrl && currentFacs !== iiifUrl) {
            // Only update if it's a /files/large/ URL (not already IIIF)
            if (currentFacs.indexOf('/files/large/') > -1 || currentFacs.indexOf('/iiif/') === -1) {
                console.log(`  Updating pb: ${nValue}`);
                console.log(`    FROM: ${currentFacs}`);
                console.log(`    TO:   ${iiifUrl}`);
                updated = true;
                return fullMatch.replace(facsMatch[0], `facs="${iiifUrl}"`);
            }
        }

        return fullMatch;
    });

    if (updated) {
        // Create backup
        const backupPath = filePath + '.backup';
        fs.copyFileSync(filePath, backupPath);
        console.log(`  Created backup: ${backupPath}`);

        // Write updated content
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`  ✅ Updated: ${filePath}`);
        return true;
    } else {
        console.log(`  No updates needed.`);
        return false;
    }
}

function processDirectory(dirPath) {
    console.log(`Scanning directory: ${dirPath}\n`);

    const files = fs.readdirSync(dirPath);
    let totalUpdated = 0;

    files.forEach(file => {
        if (file.endsWith('.xml') && !file.endsWith('.backup')) {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isFile()) {
                const wasUpdated = updateXMLFile(filePath);
                if (wasUpdated) totalUpdated++;
            }
        }
    });

    console.log(`\n=== Summary ===`);
    console.log(`Total files updated: ${totalUpdated}`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node update-pb-iiif-urls.js <directory>');
    console.error('Example: node update-pb-iiif-urls.js evt-viewer/app/data/busta-10');
    process.exit(1);
}

const dirPath = args[0];
if (!fs.existsSync(dirPath)) {
    console.error(`Error: Directory not found: ${dirPath}`);
    process.exit(1);
}

processDirectory(dirPath);
