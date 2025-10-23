#!/usr/bin/env python3
"""
Script to update TEI XML files with IIIF image URLs from CDC Classense manifests

Usage: python3 update_xml_with_iiif.py <xml_directory>
Example: python3 update_xml_with_iiif.py evt-viewer/app/data/busta-10
"""

import requests
import xml.etree.ElementTree as ET
import sys
import os
import re
from pathlib import Path

BASE_IIIF_URL = "https://www.cdc.classense.ra.it/iiif/2"

def fetch_manifest(manifest_id):
    """Fetch IIIF manifest and return image service IDs"""
    manifest_url = f"{BASE_IIIF_URL}/{manifest_id}/manifest"
    print(f"  Fetching manifest: {manifest_url}")

    try:
        response = requests.get(manifest_url, timeout=10)
        response.raise_for_status()
        manifest = response.json()

        images = []
        if "sequences" in manifest:
            for sequence in manifest["sequences"]:
                if "canvases" in sequence:
                    for canvas in sequence["canvases"]:
                        if "images" in canvas:
                            for image in canvas["images"]:
                                if "resource" in image and "service" in image["resource"]:
                                    service_id = image["resource"]["service"]["@id"]
                                    # Get full image URL with reasonable size
                                    # Format: {service_id}/full/800,/0/default.jpg
                                    img_url = f"{service_id}/full/800,/0/default.jpg"
                                    images.append(img_url)
                                    print(f"    Found image: {img_url}")

        return images
    except Exception as e:
        print(f"  ⚠️  Error fetching manifest: {e}")
        return []

def extract_manifest_id_from_xml(xml_path):
    """Extract manifest ID from facsimile/@sameAs in XML"""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        # Handle TEI namespace
        namespaces = {'tei': 'http://www.tei-c.org/ns/1.0'}

        # Try with namespace
        facsimile = root.find('.//tei:facsimile[@sameAs]', namespaces)
        if facsimile is None:
            # Try without namespace
            facsimile = root.find('.//{http://www.tei-c.org/ns/1.0}facsimile[@sameAs]')
        if facsimile is None:
            facsimile = root.find('.//facsimile[@sameAs]')

        if facsimile is not None:
            manifest_url = facsimile.get('sameAs')
            if manifest_url:
                # Extract ID from URL like: https://classense.unibo.it/iiif/20634/manifest
                match = re.search(r'/iiif/(?:2/)?(\d+)/manifest', manifest_url)
                if match:
                    return match.group(1)

        print(f"  ⚠️  No manifest ID found in facsimile/@sameAs")
        return None
    except Exception as e:
        print(f"  ⚠️  Error parsing XML: {e}")
        return None

def update_pb_elements(xml_path, iiif_images):
    """Update <pb> elements with IIIF URLs"""
    if not iiif_images:
        print(f"  No IIIF images to update")
        return False

    try:
        # Read file as text to preserve formatting
        with open(xml_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Create backup
        backup_path = str(xml_path) + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Created backup: {backup_path}")

        # Find all <pb> elements with facs attribute
        pb_pattern = r'<pb([^>]*?)facs="([^"]+)"([^>]*?)>'

        pb_matches = list(re.finditer(pb_pattern, content))

        if len(pb_matches) == 0:
            print(f"  No <pb> elements with facs attribute found")
            return False

        print(f"  Found {len(pb_matches)} <pb> elements")
        print(f"  Have {len(iiif_images)} IIIF images")

        # Check for mismatch
        if len(pb_matches) != len(iiif_images):
            print(f"  ⚠️  Warning: Mismatch between <pb> elements ({len(pb_matches)}) and IIIF images ({len(iiif_images)})")
            if len(pb_matches) > len(iiif_images):
                print(f"      Will update first {len(iiif_images)} <pb> elements only")
            else:
                print(f"      Some IIIF images will not be used")

        # Update each pb element with corresponding IIIF image
        updated = False
        offset = 0

        for i, match in enumerate(pb_matches):
            if i >= len(iiif_images):
                break

            old_facs = match.group(2)
            new_facs = iiif_images[i]

            # Only update if it's not already a IIIF URL or if it's /files/large/
            if '/files/large/' in old_facs or '/iiif/' not in old_facs:
                print(f"  Updating pb #{i+1}:")
                print(f"    FROM: {old_facs}")
                print(f"    TO:   {new_facs}")

                # Replace in content
                start = match.start() + offset
                end = match.end() + offset
                old_match = content[start:end]
                new_match = old_match.replace(f'facs="{old_facs}"', f'facs="{new_facs}"')

                content = content[:start] + new_match + content[end:]
                offset += len(new_match) - len(old_match)
                updated = True

        if updated:
            # Write updated content
            with open(xml_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✅ Updated: {xml_path}")
            return True
        else:
            print(f"  No updates needed (already using IIIF URLs)")
            return False

    except Exception as e:
        print(f"  ❌ Error updating XML: {e}")
        return False

def process_xml_file(xml_path):
    """Process a single XML file"""
    print(f"\n{'='*80}")
    print(f"Processing: {xml_path}")
    print('='*80)

    # Extract manifest ID from XML
    manifest_id = extract_manifest_id_from_xml(xml_path)
    if not manifest_id:
        print(f"  Skipping (no manifest ID found)")
        return False

    print(f"  Manifest ID: {manifest_id}")

    # Fetch IIIF images from manifest
    iiif_images = fetch_manifest(manifest_id)

    if not iiif_images:
        print(f"  Skipping (no images in manifest)")
        return False

    # Update XML with IIIF URLs
    return update_pb_elements(xml_path, iiif_images)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 update_xml_with_iiif.py <xml_directory>")
        print("Example: python3 update_xml_with_iiif.py evt-viewer/app/data/busta-10")
        sys.exit(1)

    xml_dir = Path(sys.argv[1])

    if not xml_dir.exists():
        print(f"Error: Directory not found: {xml_dir}")
        sys.exit(1)

    print(f"\nScanning directory: {xml_dir}")
    print(f"Looking for .xml files...\n")

    xml_files = sorted(xml_dir.glob('*.xml'))
    xml_files = [f for f in xml_files if not f.name.endswith('.backup')]

    if not xml_files:
        print(f"No XML files found in {xml_dir}")
        sys.exit(1)

    print(f"Found {len(xml_files)} XML files\n")

    updated_count = 0
    for xml_file in xml_files:
        if process_xml_file(xml_file):
            updated_count += 1

    print(f"\n{'='*80}")
    print(f"Summary: Updated {updated_count} out of {len(xml_files)} files")
    print('='*80)

if __name__ == "__main__":
    main()
