"""初始化隔离的 PC 测试数据；不连接共享目录或复制已有账本。"""
import argparse
from dataclasses import replace
import json
import os
from pathlib import Path
import subprocess
import sys


def prepare(data_root: Path, media_root: Path, port: int):
    for path in (data_root, media_root):
        if str(path).startswith(('\\\\', '//')):
            raise ValueError('PC test storage must be a local folder')
    if not 1024 <= port <= 65535:
        raise ValueError('Choose a port between 1024 and 65535')
    data_root, media_root = data_root.resolve(), media_root.resolve()
    media_root.mkdir(parents=True, exist_ok=True)
    os.environ['PEACH_DATA_ROOT'] = str(data_root)
    os.environ['PYTHONUTF8'] = '1'
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    if not (data_root / 'config.toml').exists():
        state = data_root / 'state'
        state.mkdir(parents=True, exist_ok=True)
        (state / 'remote-reporting.json').write_text(json.dumps(
            {'usage': False, 'errors': False, 'revision': 'pc-test'}), encoding='utf-8')
        subprocess.run([sys.executable, '-X', 'utf8', '-m', 'peach', 'init', '--no-input',
                        '--data-root', str(data_root), '--host', '127.0.0.1',
                        '--port', str(port)], check=True)
        from peach import settings_file
        config = settings_file.load_config()
        config = replace(config, locations={'local': (str(media_root),)}, mounts={},
                         library_names={str(media_root): 'PC test library'})
        settings_file.write(config, force=True)
        (state / 'push-discovery.json').write_text(json.dumps({
            'enabled': True, 'watch_local': True, 'poll_local': True, 'cloud': False,
            'prefixes': []}), encoding='utf-8')
        (state / 'media-processing.json').write_text(json.dumps({'metadata_only': True}), encoding='utf-8')
    print(f'PC test: http://localhost:{port}')
    print(f'Local media: {media_root}')
    print(f'Access token: {(data_root / "secrets" / "auth-token").read_text().strip()}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-root', type=Path, required=True)
    parser.add_argument('--media-root', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8910)
    args = parser.parse_args()
    prepare(args.data_root, args.media_root, args.port)
