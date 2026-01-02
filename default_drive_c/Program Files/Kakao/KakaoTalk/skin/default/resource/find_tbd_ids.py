#!/usr/bin/env python3
import os
import sys
import tempfile
import xml.etree.ElementTree as ET


def get_trimmed_text(parent: ET.Element, tag_name: str) -> str:
    child = parent.find(tag_name)
    if child is None:
        return ""
    text = child.text or ""
    return text.strip()


def process_iterparse(context):
    for event, elem in context:
        # Only care when a <String> element is fully parsed
        if event == "end" and elem.tag == "String":
            string_id = elem.get("ID", "").strip()
            if string_id:
                en_text = get_trimmed_text(elem, "en")
                ja_text = get_trimmed_text(elem, "ja")
                if en_text == "TBD" or ja_text == "TBD":
                    ko_text = get_trimmed_text(elem, "ko")
                    # 탭 구분( TSV )으로 ID와 ko 값을 함께 출력
                    print(f"{string_id}\t{ko_text}")
            # Free memory progressively
            elem.clear()


def find_tbd_ids(xml_path: str) -> None:
    # First attempt: parse as-is (well-formed XML with a single root like <Items>)
    try:
        context = ET.iterparse(xml_path, events=("end",))
        process_iterparse(context)
        return
    except ET.ParseError:
        # Fall back: wrap with a synthetic root to handle XML fragments listing <String> siblings
        pass

    # Create a temporary wrapped file to avoid loading the whole content into memory
    tmp_path = None
    try:
        with open(xml_path, "rb") as src, tempfile.NamedTemporaryFile(
            mode="wb", delete=False, suffix=".xml"
        ) as tmp:
            tmp.write(b"<Items>")
            # Stream copy the original file content
            for chunk in iter(lambda: src.read(1024 * 1024), b""):
                tmp.write(chunk)
            tmp.write(b"</Items>")
            tmp_path = tmp.name

        context = ET.iterparse(tmp_path, events=("end",))
        process_iterparse(context)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def main():
    xml_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.path.join("build", "skin", "default", "resource", "string_merge.xml")
    )
    find_tbd_ids(xml_path)


if __name__ == "__main__":
    main()


