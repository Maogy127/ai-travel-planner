from pathlib import Path
"""SpeechRecognition mock regressions at desktop/mobile; own port 8822."""
import asyncio
import subprocess
import sys
from playwright.async_api import async_playwright, expect
from test_full import new, readable, SITE

BASE = 'http://127.0.0.1:8822/index.html'
MOCK = '''
window.voiceCalls = {start:0, stop:0};
window.SpeechRecognition = class {
    constructor(){window.recognition = this;}
    start(){voiceCalls.start++;voiceCalls.lang=this.lang;}
    stop(){voiceCalls.stop++;if(this.onend)this.onend();}
    abort(){}
};
window.webkitSpeechRecognition = undefined;
window.voiceResult = (text, final) => {
    const result = [{transcript:text}]; result.isFinal=final;
    recognition.onresult({resultIndex:0, results:[result]});
};
'''


async def musts(pg):
    # Same question renderer used by the onboarding flow; the exposed inspection
    # navigation avoids repeating unrelated budget/date steps in each mock case.
    await pg.evaluate("window.__gonow.go('musts')")
    await expect(pg.get_by_test_id('mustdos')).to_be_visible()


async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.add_init_script(MOCK)
            await pg.reload()
            await musts(pg)
            button = pg.get_by_test_id('voice-btn')
            field = pg.get_by_test_id('mustdos')
            status = pg.get_by_test_id('voice-status')
            await expect(button).to_be_visible()
            await expect(button).to_be_enabled()
            default = await pg.evaluate("navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'")
            await expect(pg.get_by_test_id('voice-lang')).to_have_value(default)
            await field.fill('Existing request')
            await pg.get_by_test_id('voice-lang').select_option('zh-CN')
            await button.click()
            assert await pg.evaluate('voiceCalls.lang') == 'zh-CN'
            assert await pg.evaluate('recognition.interimResults && !recognition.continuous')
            await expect(button).to_have_attribute('aria-pressed', 'true')
            contrast = await readable(pg, '[data-testid=voice-btn]')
            assert contrast['ratio'] >= 4.5, contrast
            await expect(status).to_contain_text('Listening')
            await pg.evaluate("voiceResult('海边', false)")
            await expect(status).to_have_text('海边')
            await expect(field).to_have_value('Existing request')
            await pg.evaluate("voiceResult('海边散步', true)")
            await expect(field).to_have_value('Existing request，海边散步')
            await field.press('End')
            await field.press_sequentially(' and dinner')
            value = await field.input_value()
            assert await pg.evaluate('window.__gonow.state.answers.mustdos') == value
            await pg.evaluate("recognition.onerror({error:'not-allowed'})")
            await expect(status).to_have_text('Microphone permission was blocked.')
            await expect(button).to_have_attribute('aria-pressed', 'false')
            await pg.evaluate('recognition.onend()')
            await expect(status).to_have_text('Microphone permission was blocked.')
            await button.click()
            await button.click()
            assert await pg.evaluate('voiceCalls.stop') == 1
            await expect(button).to_have_attribute('aria-pressed', 'false')
            await pg.reload()
            await musts(pg)
            await expect(field).to_have_value(value)
            await expect(pg.get_by_test_id('voice-lang')).to_have_value('zh-CN')
            await pg.get_by_test_id('voice-lang').select_option('en-US')
            await button.click()
            assert await pg.evaluate('voiceCalls.lang') == 'en-US'
            await pg.evaluate("voiceResult('hiking', true)")
            await expect(field).to_have_value(value + ', hiking')
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS voice languages, interim/final, editability, persistence, permission and stop', width)
        finally:
            await ctx.close()
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.add_init_script('delete window.SpeechRecognition; delete window.webkitSpeechRecognition;')
            await pg.reload()
            await musts(pg)
            await expect(pg.get_by_test_id('voice-unsupported')).to_have_text('Voice input needs Chrome, Edge or Safari.')
            await expect(pg.get_by_test_id('voice-btn')).to_be_disabled()
            print('PASS unsupported voice', width)
        finally:
            await ctx.close()


async def main():
    server = subprocess.Popen([sys.executable, str(Path(__file__).parent / 'serve_site.py'), '8822'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                _, writer = await asyncio.open_connection('127.0.0.1', 8822)
                writer.close()
                await writer.wait_closed()
                break
            except OSError:
                await asyncio.sleep(.1)
        else:
            raise RuntimeError('Server failed to start')
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                await checks(browser)
            finally:
                await browser.close()
    finally:
        server.terminate()
        server.wait()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        print('FAIL voice:', error)
        raise
