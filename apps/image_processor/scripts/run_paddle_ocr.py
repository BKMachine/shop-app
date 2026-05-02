#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Run local PaddleOCR over an image crop.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--crop", help="left,top,width,height crop in source image coordinates")
    parser.add_argument(
        "--filter-crop",
        help="left,top,width,height region; run OCR on the full image but keep tokens centered in this region",
    )
    parser.add_argument(
        "--exclude-crop",
        help="left,top,width,height region; drop tokens centered in this region",
    )
    parser.add_argument("--model", default="PP-OCRv5_server_rec")
    return parser.parse_args()


def crop_image(source_path, crop_value):
    if not crop_value:
        return source_path

    from PIL import Image

    left, top, width, height = [int(value) for value in crop_value.split(",")]
    source = Image.open(source_path)
    cropped = source.crop((left, top, left + width, top + height))
    output_path = Path(source_path).with_name(f"{Path(source_path).stem}-paddle-crop.jpg")
    cropped.save(output_path, quality=95)
    return str(output_path)


def parse_crop(crop_value):
    if not crop_value:
        return None
    left, top, width, height = [int(value) for value in crop_value.split(",")]
    return (left, top, left + width, top + height)


def box_center_in_crop(box, crop):
    if crop is None:
        return False
    center_x = (int(box[0]) + int(box[2])) / 2
    center_y = (int(box[1]) + int(box[3])) / 2
    left, top, right, bottom = crop
    return left <= center_x <= right and top <= center_y <= bottom


def group_lines(tokens):
    lines = []
    for token in sorted(tokens, key=lambda item: (item["box"][1], item["box"][0])):
        top = int(token["box"][1])
        line = next(
            (
                candidate
                for candidate in lines
                if abs(top - candidate["top"]) <= max(18, candidate["height"] * 0.3)
            ),
            None,
        )
        if line is None:
            lines.append(
                {
                    "top": top,
                    "height": max(1, int(token["box"][3]) - int(token["box"][1])),
                    "tokens": [token],
                }
            )
        else:
            line["tokens"].append(token)
            line["tokens"].sort(key=lambda item: item["box"][0])
            tops = [int(item["box"][1]) for item in line["tokens"]]
            heights = [max(1, int(item["box"][3]) - int(item["box"][1])) for item in line["tokens"]]
            line["top"] = sum(tops) / len(tops)
            line["height"] = max(heights)
    return lines


def line_text(line):
    tokens = [item["text"].strip() for item in line["tokens"]]
    return " ".join(token for token in tokens if token).strip()


def main():
    args = parse_args()
    os.environ.setdefault("FLAGS_use_mkldnn", "0")

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": f'Missing PaddleOCR dependencies. Install them with "pnpm --dir apps/image_processor run install:ocr". {exc}'
                }
            ),
            file=sys.stderr,
        )
        return 2

    image_path = crop_image(args.input, args.crop)
    filter_crop = parse_crop(args.filter_crop)
    exclude_crop = parse_crop(args.exclude_crop)
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        text_detection_model_name="PP-OCRv5_server_det",
        text_recognition_model_name=args.model,
    )
    results = ocr.predict(image_path)
    tokens = []
    for result in results:
        rec_texts = result.get("rec_texts") or []
        rec_scores = result.get("rec_scores") or []
        rec_boxes = result.get("rec_boxes")
        if rec_boxes is None:
            rec_boxes = []
        for text, score, box in zip(rec_texts, rec_scores, rec_boxes):
            plain_box = [int(value) for value in box.tolist()]
            if filter_crop is not None and not box_center_in_crop(plain_box, filter_crop):
                continue
            if box_center_in_crop(plain_box, exclude_crop):
                continue
            tokens.append({"text": str(text), "score": float(score), "box": plain_box})

    lines = group_lines(tokens)
    text_lines = [line_text(line) for line in lines]
    text_lines = [line for line in text_lines if line]
    confidence = sum(token["score"] for token in tokens) / len(tokens) if tokens else 0
    print(json.dumps({"text": "\n".join(text_lines), "confidence": confidence, "tokens": tokens}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
