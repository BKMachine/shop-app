#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove image background with rembg on CPU only.")
    parser.add_argument("--input", required=True, help="Source image path")
    parser.add_argument("--output", required=True, help="Destination PNG path")
    parser.add_argument("--model", default="isnet-general-use", help="rembg model name")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    os.environ["CUDA_VISIBLE_DEVICES"] = ""

    try:
        from rembg import new_session, remove
    except ImportError as exc:
        print(
            'Missing rembg dependencies. Install them with "pnpm --dir apps/image_processor run install:rembg".',
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 2

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.is_file():
        print(f"Input image not found: {input_path}", file=sys.stderr)
        return 2

    try:
        session = new_session(args.model, providers=["CPUExecutionProvider"])

        with input_path.open("rb") as input_file:
            input_bytes = input_file.read()

        output_bytes = remove(input_bytes, session=session, force_return_bytes=True)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(output_bytes)
        print(f"Wrote {output_path}")
        return 0
    except Exception as exc:
        print(f"rembg inference failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())