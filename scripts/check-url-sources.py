#!/usr/bin/env python3
"""
Script to check which image URLs are from CDC vs Unibo
and generate a report showing migration status

Usage: python3 check-url-sources.py <xml_directory>
Example: python3 check-url-sources.py evt-viewer/app/data/busta-10
"""

import re
import sys
from pathlib import Path
from datetime import datetime

def analyze_pb_urls(xml_path):
    """Analyze pb elements and their facs URLs"""
    try:
        with open(xml_path, 'r', encoding='utf-8') as f:
            content = f.read()

        pb_pattern = r'<pb([^>]*?)facs="([^"]+)"([^>]*?)>'
        pb_matches = list(re.finditer(pb_pattern, content))

        cdc_count = 0
        unibo_count = 0
        other_count = 0

        cdc_urls = []
        unibo_urls = []
        other_urls = []

        for match in pb_matches:
            url = match.group(2)
            if 'www.cdc.classense.ra.it' in url:
                cdc_count += 1
                cdc_urls.append(url)
            elif 'classense.unibo.it' in url:
                unibo_count += 1
                unibo_urls.append(url)
            else:
                other_count += 1
                other_urls.append(url)

        return {
            'total': len(pb_matches),
            'cdc': cdc_count,
            'unibo': unibo_count,
            'other': other_count,
            'cdc_urls': cdc_urls,
            'unibo_urls': unibo_urls,
            'other_urls': other_urls
        }
    except Exception as e:
        print(f"  ⚠️  Error analyzing {xml_path.name}: {e}")
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 check-url-sources.py <xml_directory>")
        print("Example: python3 check-url-sources.py evt-viewer/app/data/busta-10")
        sys.exit(1)

    xml_dir = Path(sys.argv[1])

    if not xml_dir.exists():
        print(f"Error: Directory not found: {xml_dir}")
        sys.exit(1)

    print(f"\nScanning directory: {xml_dir}")
    print(f"Analyzing image URL sources...\n")

    xml_files = sorted(xml_dir.glob('*.xml'))
    xml_files = [f for f in xml_files if not f.name.endswith('.backup')]

    if not xml_files:
        print(f"No XML files found in {xml_dir}")
        sys.exit(1)

    print(f"Found {len(xml_files)} XML files\n")

    results = []
    total_cdc = 0
    total_unibo = 0
    total_other = 0

    for i, xml_file in enumerate(xml_files, 1):
        print(f"[{i}/{len(xml_files)}] Analyzing {xml_file.name}...", end=' ')
        analysis = analyze_pb_urls(xml_file)

        if analysis:
            results.append({
                'file': xml_file.name,
                **analysis
            })
            total_cdc += analysis['cdc']
            total_unibo += analysis['unibo']
            total_other += analysis['other']

            status = []
            if analysis['cdc'] > 0:
                status.append(f"CDC: {analysis['cdc']}")
            if analysis['unibo'] > 0:
                status.append(f"Unibo: {analysis['unibo']}")
            if analysis['other'] > 0:
                status.append(f"Other: {analysis['other']}")

            print(f"[{', '.join(status)}]")

    # Generate report
    report_path = xml_dir / 'url-sources-report.md'
    report = f"# Image URL Sources Report\n\n"
    report += f"Generated: {datetime.now().isoformat()}\n\n"
    report += f"Directory: {xml_dir}\n\n"
    report += f"## Summary\n\n"

    total_images = total_cdc + total_unibo + total_other
    report += f"- **Total images**: {total_images}\n"
    report += f"- **CDC images** (www.cdc.classense.ra.it): {total_cdc} ({total_cdc/total_images*100:.1f}%)\n"
    report += f"- **Unibo images** (classense.unibo.it): {total_unibo} ({total_unibo/total_images*100:.1f}%)\n"
    if total_other > 0:
        report += f"- **Other sources**: {total_other}\n"
    report += "\n"

    # Files with mixed sources
    mixed_files = [r for r in results if r['cdc'] > 0 and r['unibo'] > 0]
    unibo_only = [r for r in results if r['unibo'] > 0 and r['cdc'] == 0]
    cdc_only = [r for r in results if r['cdc'] > 0 and r['unibo'] == 0]

    report += f"- **Files with CDC only**: {len(cdc_only)}\n"
    report += f"- **Files with Unibo only**: {len(unibo_only)}\n"
    report += f"- **Files with mixed sources**: {len(mixed_files)}\n\n"

    # Detailed breakdown
    if unibo_only:
        report += f"## Files with Unibo URLs Only ({len(unibo_only)} files)\n\n"
        report += "**Status**: These files can be migrated to CDC\n\n"
        report += "| File | Images |\n"
        report += "|------|--------|\n"
        for r in unibo_only:
            report += f"| {r['file']} | {r['unibo']} |\n"
        report += "\n"

    if mixed_files:
        report += f"## Files with Mixed Sources ({len(mixed_files)} files)\n\n"
        report += "**Status**: These files have both CDC and Unibo URLs (likely letters with attachments)\n\n"
        report += "| File | CDC | Unibo | Total |\n"
        report += "|------|-----|-------|-------|\n"
        for r in mixed_files:
            report += f"| {r['file']} | {r['cdc']} | {r['unibo']} | {r['total']} |\n"
        report += "\n"

        report += "### Details\n\n"
        for r in mixed_files:
            report += f"#### {r['file']}\n\n"
            report += f"- Total images: {r['total']}\n"
            report += f"- CDC images: {r['cdc']}\n"
            report += f"- Unibo images: {r['unibo']}\n\n"

    if cdc_only:
        report += f"## Files with CDC URLs Only ({len(cdc_only)} files)\n\n"
        report += "**Status**: Already migrated to CDC ✅\n\n"
        report += f"Total: {len(cdc_only)} files\n\n"

    # Recommendations
    report += "## Recommendations\n\n"
    if unibo_only:
        report += f"1. **Migrate {len(unibo_only)} files** from Unibo to CDC using the update script\n"
    if mixed_files:
        report += f"2. **Review {len(mixed_files)} files with mixed sources** - these likely have attachments stored on different servers\n"
    if total_unibo == 0:
        report += "✅ All files are already using CDC URLs!\n"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n{'='*80}")
    print(f"Report generated: {report_path}")
    print(f"\nSummary:")
    print(f"  Total images: {total_images}")
    print(f"  CDC: {total_cdc} ({total_cdc/total_images*100:.1f}%)")
    print(f"  Unibo: {total_unibo} ({total_unibo/total_images*100:.1f}%)")
    print('='*80)

if __name__ == "__main__":
    main()
