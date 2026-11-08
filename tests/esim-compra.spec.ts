import { test, expect } from '@playwright/test';

const CIDADE_COM_COBERTURA = 'Juazeiro do Norte';
const CIDADE_SEM_COBERTURA = 'São Paulo';

test.describe('COEQ - Jornada de Consulta de Cobertura e Ofertas eSIM', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('https://brisanet-d1.cx.brisanet.net.br/internet-movel-4g-5g', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  });

  test('CT-000: Validar rejeição do termo de consentimento de cookies', async ({ page }) => {
    await test.step('DADO que o cliente acessa o site e visualiza o banner de privacidade', async () => {
      const bannerCookies = page.getByRole('dialog', { name: 'Control your privacy' })
        .or(page.locator('text=Control your privacy'))
        .first();
      await expect(bannerCookies).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'evidencias/CT000-01-banner-cookies-visivel.png' });
    });

    await test.step('QUANDO o cliente clica no botão "Reject"', async () => {
      const botaoRejeitar = page.getByRole('button', { name: 'Reject' });
      await botaoRejeitar.click();
    });

    await test.step('ENTÃO o banner de consentimento deve ser fechado', async () => {
      const bannerCookies = page.getByRole('dialog', { name: 'Control your privacy' });
      await expect(bannerCookies).not.toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'evidencias/CT000-02-cookies-rejeitados.png' });
    });
  });

  test('CT-001: Consulta de cobertura com localidade disponível e listagem de ofertas elegíveis', async ({ page }) => {
    const botaoRejeitar = page.getByRole('button', { name: 'Reject' });
    if (await botaoRejeitar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await botaoRejeitar.click();
    }

    await test.step(`DADO que o cliente informa uma cidade com cobertura disponível ("${CIDADE_COM_COBERTURA}")`, async () => {
      const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
      await inputCidade.waitFor({ state: 'visible', timeout: 10000 });
      await inputCidade.click();
      await inputCidade.fill('');
      await inputCidade.pressSequentially(CIDADE_COM_COBERTURA, { delay: 120 });
      await page.screenshot({ path: 'evidencias/CT001-01-cidade-com-cobertura-digitada.png' });
    });

    await test.step('QUANDO o sistema concluir a consulta de cobertura', async () => {
      const opcaoCidade = page.getByRole('option').filter({ hasText: CIDADE_COM_COBERTURA }).first();
      await opcaoCidade.waitFor({ state: 'visible', timeout: 8000 });
      await opcaoCidade.click({ force: true });
      await page.waitForTimeout(2000);
    });

    await test.step('ENTÃO deverá exibir as ofertas elegíveis para a cidade informada', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').or(page.locator('text=Aproveitar oferta')).first();
      await expect(secaoOfertas).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT001-02-ofertas-elegiveis-exibidas.png', fullPage: true });
    });
  });

  test('CT-002: Consulta de cobertura com localidade indisponível', async ({ page }) => {
    const botaoRejeitar = page.getByRole('button', { name: 'Reject' });
    if (await botaoRejeitar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await botaoRejeitar.click();
    }

    await test.step('DADO que o cliente informa uma cidade sem cobertura disponível ("São Paulo - SP")', async () => {
      const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
      await inputCidade.waitFor({ state: 'visible', timeout: 10000 });
      await inputCidade.click();
      await inputCidade.fill('');
      await inputCidade.pressSequentially('São Paulo', { delay: 120 });

      // Aguarda o container do listbox abrir
      const listbox = page.locator('[role="listbox"]').or(page.getByRole('listbox')).first();
      await listbox.waitFor({ state: 'visible', timeout: 8000 });

      // Localiza o item específico "São Paulo - SP" dentro do listbox e clica forçado
      const opcaoSP = listbox.locator('[role="option"]').filter({ hasText: 'São Paulo - SP' })
        .or(page.getByRole('option', { name: 'São Paulo - SP' }))
        .first();

      await opcaoSP.waitFor({ state: 'visible', timeout: 8000 });
      await opcaoSP.scrollIntoViewIfNeeded();
      await opcaoSP.click({ force: true });

      await page.screenshot({ path: 'evidencias/CT002-01-cidade-sem-cobertura-selecionada.png' });
    });

    await test.step('QUANDO o sistema concluir a consulta de cobertura', async () => {
      // Aguarda o modal anterior fechar ou o novo modal abrir
      await page.waitForTimeout(2500);
    });

    await test.step('ENTÃO deverá apresentar a mensagem de indisponibilidade, a opção de tentar outro endereço e o botão para o site principal', async () => {
      const modalIndisponivel = page.locator('[role="alertdialog"], [role="dialog"]')
        .filter({ hasText: /não oferecemos serviço|sua região|Verificação de Localização/i })
        .first();
      await expect(modalIndisponivel).toBeVisible({ timeout: 15000 });

      const mensagemIndisponivel = modalIndisponivel.getByRole('heading', { name: 'Ainda não oferecemos serviço em sua região' })
        .or(modalIndisponivel.locator('text=Ainda não oferecemos serviço em sua região'))
        .first();
      await expect(mensagemIndisponivel).toBeVisible({ timeout: 10000 });

      const botaoTentarOutro = modalIndisponivel.getByRole('button', { name: 'Tentar outro endereço' });
      await expect(botaoTentarOutro).toBeVisible({ timeout: 5000 });

      const botaoPaginaInicial = modalIndisponivel.getByRole('button', { name: 'Página inicial' });
      await expect(botaoPaginaInicial).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'evidencias/CT002-02-tela-indisponibilidade.png' });
    });
  });

  test('CT-003: Recuperação após indisponibilidade com nova tentativa para cidade com cobertura', async ({ page }) => {
    const botaoRejeitar = page.getByRole('button', { name: 'Reject' });
    if (await botaoRejeitar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await botaoRejeitar.click();
    }

    await test.step('DADO que o cliente está na tela de indisponibilidade de cobertura', async () => {
      const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
      await inputCidade.waitFor({ state: 'visible', timeout: 10000 });
      await inputCidade.click();
      await inputCidade.fill('');
      await inputCidade.pressSequentially('São Paulo', { delay: 120 });

      const listbox = page.locator('[role="listbox"]').or(page.getByRole('listbox')).first();
      await listbox.waitFor({ state: 'visible', timeout: 8000 });

      const opcaoSP = listbox.locator('[role="option"]').filter({ hasText: 'São Paulo - SP' })
        .or(page.getByRole('option', { name: 'São Paulo - SP' }))
        .first();

      await opcaoSP.waitFor({ state: 'visible', timeout: 8000 });
      await opcaoSP.scrollIntoViewIfNeeded();
      await opcaoSP.click({ force: true });

      const modalIndisponivel = page.locator('[role="alertdialog"], [role="dialog"]')
        .filter({ hasText: /não oferecemos serviço|sua região|Verificação de Localização/i })
        .first();
      await expect(modalIndisponivel).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT003-01-estado-inicial-indisponivel.png' });
    });

    await test.step(`QUANDO selecionar a opção de tentar outro endereço e informar uma nova localidade ("${CIDADE_COM_COBERTURA}")`, async () => {
      const botaoTentarOutro = page.getByRole('button', { name: 'Tentar outro endereço' });
      await botaoTentarOutro.click();

      const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
      await inputCidade.waitFor({ state: 'visible', timeout: 10000 });
      await inputCidade.click();
      await inputCidade.fill('');
      await inputCidade.pressSequentially(CIDADE_COM_COBERTURA, { delay: 120 });

      const listbox = page.locator('[role="listbox"]').or(page.getByRole('listbox')).first();
      await listbox.waitFor({ state: 'visible', timeout: 8000 });

      const opcaoComCobertura = listbox.locator('[role="option"]').filter({ hasText: CIDADE_COM_COBERTURA }).first();
      await opcaoComCobertura.waitFor({ state: 'visible', timeout: 8000 });
      await opcaoComCobertura.click({ force: true });
      await page.waitForTimeout(2000);
    });

    await test.step('ENTÃO o sistema deverá consultar novamente a cobertura e apresentar o resultado correspondente à nova cidade', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').or(page.locator('text=Aproveitar oferta')).first();
      await expect(secaoOfertas).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT003-02-nova-consulta-com-sucesso.png', fullPage: true });
    });
  });

});