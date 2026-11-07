"""Generates the Vietnamese narration, one mp3 per scene, into public/voice/.

Run: python scripts/voiceover.py
"""

import asyncio
import pathlib

import edge_tts

VOICE = "vi-VN-NamMinhNeural"
RATE = "+6%"
PITCH = "-4Hz"

LINES = [
    "Cuộc kháng chiến chống Mỹ cứu nước, hai mươi mốt năm, từ 1954 đến 1975.",
    "Năm 1954, Hiệp định Giơnevơ được ký kết. Đất nước tạm thời bị chia cắt tại vĩ tuyến 17.",
    "Tết Mậu Thân 1968, cuộc Tổng tiến công và nổi dậy làm lung lay ý chí xâm lược của Mỹ.",
    "Cuối năm 1972, quân và dân Hà Nội làm nên trận Điện Biên Phủ trên không, đánh bại cuộc tập kích bằng B-52.",
    "Tháng Giêng năm 1973, Hiệp định Paris được ký kết. Mỹ phải rút toàn bộ quân về nước.",
    "Ngày 30 tháng 4 năm 1975, miền Nam hoàn toàn giải phóng. Non sông thu về một mối.",
]

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "voice"


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, text in enumerate(LINES):
        # The service occasionally returns no audio; retry a few times.
        for attempt in range(10):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(
                    str(OUT / f"{i}.mp3")
                )
                break
            except edge_tts.exceptions.NoAudioReceived:
                if attempt == 9:
                    raise
                print("retry", i, attempt); await asyncio.sleep(3)
        print("wrote", i)


asyncio.run(main())
