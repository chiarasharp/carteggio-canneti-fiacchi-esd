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

def extract_manifest_ids_from_xml(xml_path):
    """Extract ALL manifest IDs from facsimile/@sameAs in XML"""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        # Handle TEI namespace
        namespaces = {'tei': 'http://www.tei-c.org/ns/1.0'}

        manifest_ids = []

        # Try to find all facsimile elements with sameAs
        facsimiles = root.findall('.//tei:facsimile[@sameAs]', namespaces)
        if not facsimiles:
            facsimiles = root.findall('.//{http://www.tei-c.org/ns/1.0}facsimile[@sameAs]')
        if not facsimiles:
            facsimiles = root.findall('.//facsimile[@sameAs]')

        for facsimile in facsimiles:
            manifest_url = facsimile.get('sameAs')
            if manifest_url:
                # Extract ID from URL like: https://classense.unibo.it/iiif/20634/manifest
                match = re.search(r'/iiif/(?:2/)?(\d+)/manifest', manifest_url)
                if match:
                    manifest_ids.append(match.group(1))

        if not manifest_ids:
            print(f"  ⚠️  No manifest ID found in facsimile/@sameAs")
            return None

        return manifest_ids
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

            # Update if: it's /files/large/, OR not IIIF yet, OR it's from classense.unibo.it (migrate to CDC)
            if '/files/large/' in old_facs or '/iiif/' not in old_facs or 'classense.unibo.it' in old_facs:
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

    # Extract ALL manifest IDs from XML
    manifest_ids = extract_manifest_ids_from_xml(xml_path)
    if not manifest_ids:
        print(f"  Skipping (no manifest ID found)")
        return False

    print(f"  Manifest ID(s): {', '.join(manifest_ids)}")

    # Fetch IIIF images from ALL manifests
    all_images = []
    for manifest_id in manifest_ids:
        iiif_images = fetch_manifest(manifest_id)
        if iiif_images:
            all_images.extend(iiif_images)

    if not all_images:
        print(f"  Skipping (no images in manifest(s))")
        return False

    # Update XML with IIIF URLs
    return update_pb_elements(xml_path, all_images)

def generate_missing_images_report(results, xml_dir):
    """Generate markdown report for files with missing images"""
    from datetime import datetime

    issues = [r for r in results if r['has_issues']]

    report_path = xml_dir / 'missing-iiif-images-report.md'
    report = f"# Missing IIIF Images Report\n\n"
    report += f"Generated: {datetime.now().isoformat()}\n\n"
    report += f"Directory: {xml_dir}\n\n"
    report += f"## Summary\n\n"

    total = len(results)
    ok_count = total - len(issues)

    report += f"- **Total files checked**: {total}\n"
    report += f"- **Files with all images**: {ok_count}\n"
    report += f"- **Files with issues**: {len(issues)}\n\n"

    if not issues:
        report += "✅ **All files have matching page and image counts!**\n\n"
        report += "All XML files have been checked and every `<pb>` element has a corresponding image in the IIIF manifest(s).\n"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n📄 Report generated: {report_path}")
        print("✅ All files have matching page and image counts!")
        return

    # Categorize issues
    more_pages = [r for r in issues if r.get('pb_count', 0) > r.get('image_count', 0)]
    more_images = [r for r in issues if r.get('pb_count', 0) < r.get('image_count', 0)]
    no_manifest = [r for r in issues if r.get('issue', '').startswith('No manifest')]
    manifest_errors = [r for r in issues if 'Error' in r.get('issue', '')]

    if more_pages:
        report += f"- **Files with MORE pages than images**: {len(more_pages)} (need to add/fix images in manifest)\n"
    if more_images:
        report += f"- **Files with MORE images than pages**: {len(more_images)} (need to add `<pb>` elements)\n"
    if no_manifest:
        report += f"- **Files without manifest ID**: {len(no_manifest)} (need to add `<facsimile sameAs=\"...\">`)\n"
    if manifest_errors:
        report += f"- **Files with manifest errors**: {len(manifest_errors)}\n"

    report += "\n## Files with Issues\n\n"
    report += "| File | Manifest ID | Pages (<pb>) | Images (IIIF) | Difference | Issue |\n"
    report += "|------|-------------|--------------|---------------|------------|-------|\n"

    for r in issues:
        manifest = r.get('manifest_id', 'N/A')
        pb_count = r.get('pb_count', 0)
        img_count = r.get('image_count', 0)
        issue = r.get('issue', 'Unknown')

        # Calculate difference
        if pb_count > 0 and img_count > 0:
            diff = pb_count - img_count
            diff_str = f"+{diff} pages" if diff > 0 else f"{diff} images"
        else:
            diff_str = "N/A"

        report += f"| {r['file']} | {manifest} | {pb_count} | {img_count} | {diff_str} | {issue} |\n"

    # Detailed sections by issue type
    if more_pages:
        report += "\n## Files with MORE Pages than Images (Missing Images in Manifest)\n\n"
        report += "**Action needed**: Check if these images exist on CDC server but are missing from the manifest\n\n"
        for r in more_pages:
            diff = r.get('pb_count', 0) - r.get('image_count', 0)
            report += f"### {r['file']}\n\n"
            report += f"- **Manifest ID**: {r.get('manifest_id', 'N/A')}\n"
            report += f"- **Manifest URL**: https://www.cdc.classense.ra.it/iiif/2/{r.get('manifest_id', 'N/A')}/manifest\n"
            report += f"- **Pages in XML**: {r.get('pb_count', 0)}\n"
            report += f"- **Images in Manifest**: {r.get('image_count', 0)}\n"
            report += f"- **Missing images**: {diff}\n\n"

    if more_images:
        report += "\n## Files with MORE Images than Pages (Missing <pb> Elements)\n\n"
        report += "**Action needed**: Add missing `<pb>` elements to XML files\n\n"
        for r in more_images:
            diff = r.get('image_count', 0) - r.get('pb_count', 0)
            report += f"### {r['file']}\n\n"
            report += f"- **Manifest ID**: {r.get('manifest_id', 'N/A')}\n"
            report += f"- **Pages in XML**: {r.get('pb_count', 0)}\n"
            report += f"- **Images in Manifest**: {r.get('image_count', 0)}\n"
            report += f"- **Missing `<pb>` elements**: {diff}\n\n"

    if no_manifest:
        report += "\n## Files Without Manifest ID\n\n"
        report += "**Action needed**: Add `<facsimile sameAs=\"https://classense.unibo.it/iiif/MANIFEST_ID/manifest\">` to XML\n\n"
        for r in no_manifest:
            report += f"- {r['file']}\n"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n📄 Missing images report generated: {report_path}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 update_xml_with_iiif.py <xml_directory> [--report-only]")
        print("Example: python3 update_xml_with_iiif.py evt-viewer/app/data/busta-10")
        print("         python3 update_xml_with_iiif.py evt-viewer/app/data/busta-10 --report-only")
        sys.exit(1)

    xml_dir = Path(sys.argv[1])
    report_only = '--report-only' in sys.argv

    if not xml_dir.exists():
        print(f"Error: Directory not found: {xml_dir}")
        sys.exit(1)

    print(f"\nScanning directory: {xml_dir}")
    if report_only:
        print("Mode: Report only (no files will be modified)")
    print(f"Looking for .xml files...\n")

    xml_files = sorted(xml_dir.glob('*.xml'))
    xml_files = [f for f in xml_files if not f.name.endswith('.backup')]

    if not xml_files:
        print(f"No XML files found in {xml_dir}")
        sys.exit(1)

    print(f"Found {len(xml_files)} XML files\n")

    updated_count = 0
    results = []

    for xml_file in xml_files:
        result = {'file': xml_file.name, 'has_issues': False}

        # Extract ALL manifest IDs (files may have multiple manifests for attachments)
        manifest_ids = extract_manifest_ids_from_xml(xml_file)

        if not manifest_ids:
            result['has_issues'] = True
            result['issue'] = 'No manifest ID found'
            result['pb_count'] = 0
            result['image_count'] = 0
            result['manifest_id'] = None
            results.append(result)
            if not report_only:
                process_xml_file(xml_file)
            continue

        # Store manifest IDs for reporting
        result['manifest_id'] = ', '.join(manifest_ids) if len(manifest_ids) > 1 else manifest_ids[0]
        result['manifest_count'] = len(manifest_ids)

        # Fetch ALL manifests and combine images
        all_images = []
        for manifest_id in manifest_ids:
            iiif_images = fetch_manifest(manifest_id)
            if iiif_images:
                all_images.extend(iiif_images)

        # Count pb elements
        try:
            with open(xml_file, 'r', encoding='utf-8') as f:
                content = f.read()
            pb_pattern = r'<pb([^>]*?)facs="([^"]+)"([^>]*?)>'
            pb_matches = list(re.finditer(pb_pattern, content))
            pb_count = len(pb_matches)
        except:
            pb_count = 0

        result['pb_count'] = pb_count
        result['image_count'] = len(all_images)

        # Check for issues
        if len(all_images) == 0:
            result['has_issues'] = True
            result['issue'] = 'No images in manifest(s)'
        elif pb_count != len(all_images):
            result['has_issues'] = True
            manifests_note = f" ({len(manifest_ids)} manifests)" if len(manifest_ids) > 1 else ""
            result['issue'] = f'Mismatch: {pb_count} pages vs {len(all_images)} images{manifests_note}'

        results.append(result)

        # Process file if not report-only mode
        if not report_only:
            if process_xml_file(xml_file):
                updated_count += 1

    # Generate report
    generate_missing_images_report(results, xml_dir)

    print(f"\n{'='*80}")
    if report_only:
        ok_count = len([r for r in results if not r['has_issues']])
        print(f"Summary: {ok_count}/{len(results)} files have all images")
    else:
        print(f"Summary: Updated {updated_count} out of {len(xml_files)} files")
    print('='*80)

if __name__ == "__main__":
    main()
