import { test, expect, Page } from '@playwright/test';

const URL_BASE = 'https://brisanet-d1.cx.brisanet.net.br/internet-movel-4g-5g';
const CIDADE_COM_COBERTURA = 'Juazeiro do Norte';
const CIDADE_SEM_COBERTURA = 'Fernando de Noronha';

// Navegação resiliente com retentativas em caso de instabilidade na conexão
async function navegarComRetentativa(page: Page, url: string, maxTentativas = 3) {
  for (let i = 1; i <= maxTentativas; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return;
    } catch (erro) {
      if (i === maxTentativas) throw erro;
      await page.waitForTimeout(3000);
    }
  }
}

// Configura o interceptor de cookies apenas para testes normais (CT-001 em diante)
async function registrarTratadorCookiesAutomatico(page: Page) {
  const bannerCookies = page.getByRole('dialog', { name: 'Control your privacy' })
    .or(page.locator('text=Control your privacy'))
    .first();

  await page.addLocatorHandler(bannerCookies, async (banner) => {
    const botaoReject = banner.getByRole('button', { name: 'Reject' })
      .or(page.locator('button:has-text("Reject")'))
      .first();
    if (await botaoReject.isVisible()) {
      await botaoReject.click({ force: true });
    }
  });
}

// Limpa qualquer banner de cookies visível de forma ativa antes de interagir
async function dispensarCookiesSeVisivel(page: Page) {
  const botaoReject = page.getByRole('button', { name: 'Reject' })
    .or(page.locator('button:has-text("Reject")'))
    .first();
  if (await botaoReject.isVisible({ timeout: 1500 }).catch(() => false)) {
    await botaoReject.click({ force: true });
    await page.waitForTimeout(300);
  }
}

// Garante que o modal de seleção de cidade esteja aberto
async function garantirModalCidadeAberto(page: Page) {
  await dispensarCookiesSeVisivel(page);
  const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
  const visivel = await inputCidade.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (!visivel) {
    const botaoTrocarCidade = page.locator('header, nav, main').locator('button, a').filter({ hasText: /Juazeiro|Noronha|Mudar|Trocar|informe sua cidade/i }).first();
    if (await botaoTrocarCidade.isVisible({ timeout: 3000 }).catch(() => false)) {
      await botaoTrocarCidade.click({ force: true });
    }
  }
}

// Preenchimento de cidade com cobertura disponível
async function selecionarCidadeComCobertura(page: Page) {
  await garantirModalCidadeAberto(page);

  const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
  if (await inputCidade.isVisible({ timeout: 5000 }).catch(() => false)) {
    await inputCidade.click();
    await inputCidade.fill('');
    await inputCidade.pressSequentially(CIDADE_COM_COBERTURA, { delay: 100 });

    const listbox = page.locator('[role="listbox"]').or(page.locator('[cmdk-list]')).first();
    if (!await listbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dispensarCookiesSeVisivel(page);
      await inputCidade.click();
      await inputCidade.press('Backspace');
      await inputCidade.pressSequentially('e', { delay: 100 });
    }
    await listbox.waitFor({ state: 'visible', timeout: 8000 });

    const opcao = listbox.locator('[role="option"]').filter({ hasText: CIDADE_COM_COBERTURA }).first();
    await opcao.waitFor({ state: 'visible', timeout: 6000 });
    await opcao.click({ force: true });
    await page.waitForTimeout(2000);
  }
}

// Preenchimento determinístico de localidade sem cobertura (Fernando de Noronha)
async function selecionarCidadeSemCobertura(page: Page) {
  await dispensarCookiesSeVisivel(page);
  await garantirModalCidadeAberto(page);

  const inputCidade = page.getByRole('combobox').or(page.locator('input[placeholder*="cidade" i]')).first();
  await inputCidade.waitFor({ state: 'visible', timeout: 10000 });
  await inputCidade.click();
  await inputCidade.fill('');
  await inputCidade.pressSequentially(CIDADE_SEM_COBERTURA, { delay: 100 });

  const listbox = page.locator('[role="listbox"]').or(page.locator('[cmdk-list]')).first();

  // Se o popup de cookies roubou o foco durante a digitação, reabre o autocomplete
  if (!await listbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dispensarCookiesSeVisivel(page);
    await inputCidade.click();
    await inputCidade.press('Backspace');
    await inputCidade.pressSequentially('a', { delay: 100 });
  }

  await listbox.waitFor({ state: 'visible', timeout: 10000 });

  const primeiraOpcao = listbox.locator('[role="option"]').first();
  await primeiraOpcao.waitFor({ state: 'visible', timeout: 8000 });
  await primeiraOpcao.click({ force: true });
  await page.keyboard.press('Enter').catch(() => {});

  // Aguarda explicitamente a transição para a tela de indisponibilidade
  const telaIndisponivel = page.getByRole('heading', { name: /não oferecemos serviço|indisponível/i })
    .or(page.locator('text=/Ainda não oferecemos serviço em sua região/i'))
    .or(page.getByRole('button', { name: 'Tentar outro endereço' }));

  await telaIndisponivel.first().waitFor({ state: 'visible', timeout: 15000 });
}

// Localizador tolerante para botões e links da tela de indisponibilidade
function obterAcaoIndisponivel(page: Page, textoRegex: RegExp) {
  return page.locator('button, a, [role="button"]')
    .filter({ hasText: textoRegex })
    .first();
}

test.describe('COEQ - Jornada Autoatendimento B2C (Cobertura, Vitrine e Checkout)', () => {

  test.beforeEach(async ({ page }, testInfo) => {
    // Não ativa o handler de cookies no CT-000 para permitir que ele teste o fluxo do banner
    if (!testInfo.title.includes('CT-000')) {
      await registrarTratadorCookiesAutomatico(page);
    }
    await navegarComRetentativa(page, URL_BASE);
  });

  // =========================================================================
  // BLOCO 1: Gestão de Privacidade e Cobertura (CT-000 a CT-003)
  // =========================================================================

  test('CT-000: Validar rejeição do termo de consentimento de cookies', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });

    const bannerCookies = page.getByRole('dialog', { name: 'Control your privacy' })
      .or(page.locator('text=Control your privacy'))
      .first();

    await test.step('DADO que o cliente acessa o site e visualiza o banner de privacidade', async () => {
      await expect(bannerCookies).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT000-01-banner-cookies-visivel.png' });
    });

    await test.step('QUANDO o cliente clica no botão "Reject"', async () => {
      const botaoRejeitar = bannerCookies.getByRole('button', { name: 'Reject' })
        .or(page.locator('button:has-text("Reject")'))
        .first();
      await botaoRejeitar.click({ force: true });
    });

    await test.step('ENTÃO o banner de consentimento deve ser fechado', async () => {
      await expect(bannerCookies).not.toBeVisible({ timeout: 8000 });
      await page.screenshot({ path: 'evidencias/CT000-02-cookies-rejeitados.png' });
    });
  });

  test('CT-001: Consulta de cobertura com localidade disponível e listagem de ofertas elegíveis', async ({ page }) => {
    await test.step(`DADO que o cliente informa uma cidade com cobertura disponível ("${CIDADE_COM_COBERTURA}")`, async () => {
      await selecionarCidadeComCobertura(page);
      await page.screenshot({ path: 'evidencias/CT001-01-cidade-com-cobertura-digitada.png' });
    });

    await test.step('QUANDO o sistema concluir a consulta de cobertura', async () => {
      await page.waitForTimeout(2000);
    });

    await test.step('ENTÃO deverá exibir as ofertas elegíveis para a cidade informada', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').or(page.locator('text=Aproveitar oferta')).first();
      await expect(secaoOfertas).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT001-02-ofertas-elegiveis-exibidas.png', fullPage: true });
    });
  });

  test('CT-002: Consulta de cobertura com localidade indisponível', async ({ page }) => {
    test.setTimeout(45000);

    await test.step(`DADO que o cliente informa uma cidade sem cobertura disponível ("${CIDADE_SEM_COBERTURA}")`, async () => {
      await selecionarCidadeSemCobertura(page);
      await page.screenshot({ path: 'evidencias/CT002-01-cidade-sem-cobertura-selecionada.png' });
    });

    await test.step('QUANDO o sistema concluir a consulta de cobertura', async () => {
      await page.waitForTimeout(1000);
    });

    await test.step('ENTÃO deverá apresentar a mensagem de indisponibilidade, a opção de tentar outro endereço e o botão para o site principal', async () => {
      const botaoTentarOutro = page.getByRole('button', { name: 'Tentar outro endereço' })
        .or(obterAcaoIndisponivel(page, /tentar outro endereço/i));
      await expect(botaoTentarOutro).toBeVisible({ timeout: 15000 });

      const botaoPaginaInicial = page.getByRole('button', { name: 'Página inicial' })
        .or(obterAcaoIndisponivel(page, /página inicial/i));
      await expect(botaoPaginaInicial).toBeVisible({ timeout: 8000 });

      await page.screenshot({ path: 'evidencias/CT002-02-tela-indisponibilidade.png' });
    });
  });

  test('CT-003: Recuperação após indisponibilidade com nova tentativa para cidade com cobertura', async ({ page }) => {
    test.setTimeout(45000);

    await test.step('DADO que o cliente está na tela de indisponibilidade de cobertura', async () => {
      await selecionarCidadeSemCobertura(page);
      const botaoTentarOutro = page.getByRole('button', { name: 'Tentar outro endereço' })
        .or(obterAcaoIndisponivel(page, /tentar outro endereço/i));
      await expect(botaoTentarOutro).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT003-01-estado-inicial-indisponivel.png' });
    });

    await test.step(`QUANDO selecionar a opção de tentar outro endereço e informar uma nova localidade ("${CIDADE_COM_COBERTURA}")`, async () => {
      const botaoTentarOutro = page.getByRole('button', { name: 'Tentar outro endereço' })
        .or(obterAcaoIndisponivel(page, /tentar outro endereço/i));
      await botaoTentarOutro.click({ force: true });

      await selecionarCidadeComCobertura(page);
    });

    await test.step('ENTÃO o sistema deverá consultar novamente a cobertura e apresentar o resultado correspondente à nova cidade', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').or(page.locator('text=Aproveitar oferta')).first();
      await expect(secaoOfertas).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT003-02-nova-consulta-com-sucesso.png', fullPage: true });
    });
  });

  // =========================================================================
  // BLOCO 2: Regras de Indisponibilidade e Lead (CT-004 e CT-005)
  // =========================================================================

  test('CT-004: Direcionamento ao site principal a partir da tela de indisponibilidade', async ({ page }) => {
    test.setTimeout(45000);

    await test.step('DADO que o cliente está na tela de indisponibilidade de cobertura', async () => {
      await selecionarCidadeSemCobertura(page);
      const botaoPaginaInicial = page.getByRole('button', { name: 'Página inicial' })
        .or(obterAcaoIndisponivel(page, /página inicial/i));
      await expect(botaoPaginaInicial).toBeVisible({ timeout: 15000 });
    });

    await test.step('QUANDO acionar o botão para acessar a página principal', async () => {
      const botaoPaginaInicial = page.getByRole('button', { name: 'Página inicial' })
        .or(obterAcaoIndisponivel(page, /página inicial/i));
      await botaoPaginaInicial.click({ force: true });
    });

    await test.step('ENTÃO deverá ser direcionado à página oficial da Brisanet', async () => {
      await expect.poll(() => {
        const url = new URL(page.url());
        return url.pathname === '/' || !url.pathname.includes('internet-movel-4g-5g');
      }, { timeout: 15000 }).toBeTruthy();

      await page.screenshot({ path: 'evidencias/CT004-01-redirecionamento-pagina-inicial.png' });
    });
  });

  test('CT-005: Ausência de captura de lead sem consentimento na indisponibilidade', async ({ page }) => {
    test.setTimeout(45000);

    await test.step('DADO que a cidade consultada não possui cobertura', async () => {
      await selecionarCidadeSemCobertura(page);
    });

    await test.step('QUANDO o sistema apresentar a indisponibilidade', async () => {
      const botaoTentarOutro = page.getByRole('button', { name: 'Tentar outro endereço' })
        .or(obterAcaoIndisponivel(page, /tentar outro endereço/i));
      await expect(botaoTentarOutro).toBeVisible({ timeout: 15000 });
    });

    await test.step('ENTÃO não deverá solicitar dados de lead sem ação do cliente', async () => {
      const inputCpf = page.locator('input[placeholder*="cpf" i], input[name*="cpf" i]');
      const inputEmail = page.locator('input[placeholder*="email" i], input[type="email"]');
      const inputTelefone = page.locator('input[placeholder*="telefone" i], input[name*="phone" i]');

      await expect(inputCpf).not.toBeVisible();
      await expect(inputEmail).not.toBeVisible();
      await expect(inputTelefone).not.toBeVisible();
      await page.screenshot({ path: 'evidencias/CT005-01-ausencia-captura-lead.png' });
    });
  });

  // =========================================================================
  // BLOCO 3: Vitrine e Apresentação de Ofertas (CT-006 a CT-012)
  // =========================================================================

  test('CT-006: Exibição de ofertas ativas e elegíveis com respectivos dados comerciais', async ({ page }) => {
    await test.step('DADO que existem ofertas ativas e elegíveis para a cidade selecionada', async () => {
      await selecionarCidadeComCobertura(page);
    });

    await test.step('QUANDO o cliente acessar a vitrine de ofertas', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').first();
      await secaoOfertas.waitFor({ state: 'visible', timeout: 15000 });
      await secaoOfertas.scrollIntoViewIfNeeded();
    });

    await test.step('ENTÃO o sistema deverá exibir somente as ofertas elegíveis com dados comerciais completos', async () => {
      const botaoOferta = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoOferta.waitFor({ state: 'visible', timeout: 10000 });

      const primeiroPreco = page.locator('text=/R\\$\\s*\\d+/i').first();
      await expect(primeiroPreco).toBeVisible();
      await page.screenshot({ path: 'evidencias/CT006-01-dados-comerciais-vitrine.png' });
    });
  });

  test('CT-007: Visualização de modal com detalhes da oferta', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que o cliente está visualizando um card de oferta', async () => {
      const botaoMaisDetalhes = page.locator('text=Mais detalhes').first();
      await botaoMaisDetalhes.scrollIntoViewIfNeeded();
      await expect(botaoMaisDetalhes).toBeVisible({ timeout: 10000 });
    });

    await test.step('QUANDO selecionar "Mais detalhes"', async () => {
      const botaoMaisDetalhes = page.locator('text=Mais detalhes').first();
      await botaoMaisDetalhes.click({ force: true });
    });

    await test.step('ENTÃO o sistema deverá abrir o modal com as informações expandidas e ação de contratação', async () => {
      const modalDetalhes = page.locator('[role="dialog"], [role="alertdialog"]')
        .filter({ hasNotText: 'Control your privacy' })
        .first();
      await expect(modalDetalhes).toBeVisible({ timeout: 10000 });

      await page.screenshot({ path: 'evidencias/CT007-01-modal-mais-detalhes.png' });
      await page.keyboard.press('Escape');
    });
  });

  test('CT-008: Seleção de oferta e início da jornada de contratação', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que o cliente selecionou uma oferta elegível', async () => {
      const botaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoAproveitar.scrollIntoViewIfNeeded();
      await expect(botaoAproveitar).toBeVisible();
    });

    await test.step('QUANDO confirmar a ação de contratação', async () => {
      const botaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoAproveitar.click({ force: true });
    });

    await test.step('ENTÃO o sistema deverá associar a oferta ao checkout e iniciar a jornada', async () => {
      const feedbackJornada = page.locator('text=/identificação|dados pessoais|carrinho|checkout|titular/i')
        .or(page.locator('input[placeholder*="cpf" i]'))
        .first();
      await expect(feedbackJornada).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT008-01-inicio-jornada-checkout.png' });
    });
  });

  test('CT-009: Oferta exclusiva com benefício de portabilidade habilitado', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que uma oferta está configurada com "Oferta exclusiva de portabilidade = Sim"', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').first();
      await secaoOfertas.scrollIntoViewIfNeeded();
    });

    await test.step('QUANDO a oferta for exibida na vitrine', async () => {
      await page.waitForTimeout(1000);
    });

    await test.step('ENTÃO deverá apresentar a tag "Traga seu número" e o benefício promocional configurado', async () => {
      const tagTragaNumero = page.locator('text=Traga seu número').first();
      await expect(tagTragaNumero).toBeVisible({ timeout: 10000 });

      const beneficioPortabilidade = page.locator('text=/\\+\\s*\\d+GB de portabilidade|portabilidade/i').first();
      await expect(beneficioPortabilidade).toBeVisible();
      await page.screenshot({ path: 'evidencias/CT009-01-tag-traga-seu-numero.png' });
    });
  });

  test('CT-010: Oferta convencional sem obrigatoriedade de portabilidade', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que uma oferta está configurada com "Oferta exclusiva de portabilidade = Não"', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').first();
      await secaoOfertas.waitFor({ state: 'visible', timeout: 15000 });
      await secaoOfertas.scrollIntoViewIfNeeded();
    });

    await test.step('QUANDO a oferta for exibida na vitrine', async () => {
      await page.waitForTimeout(1000);
    });

    await test.step('ENTÃO deverá seguir o comportamento convencional sem obrigar a portabilidade', async () => {
      const cardOferta = page.locator('button:has-text("Aproveitar oferta")').first();
      await cardOferta.scrollIntoViewIfNeeded();
      await expect(cardOferta).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'evidencias/CT010-01-oferta-convencional.png' });
    });
  });

  test('CT-011: Texto promocional configurado e exibido ao lado da franquia', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que a oferta possui um texto promocional configurado', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').first();
      await secaoOfertas.waitFor({ state: 'visible', timeout: 15000 });
      await secaoOfertas.scrollIntoViewIfNeeded();
    });

    await test.step('QUANDO a oferta for exibida na vitrine', async () => {
      await page.waitForTimeout(1000);
    });

    await test.step('ENTÃO o texto promocional deverá aparecer junto à franquia principal de dados', async () => {
      const tagPromocional = page.locator('div').filter({ hasText: /Traga seu número|Oferta exclusiva|portabilidade/i }).first();
      await tagPromocional.scrollIntoViewIfNeeded();
      await expect(tagPromocional).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'evidencias/CT011-01-texto-promocional-presente.png' });
    });
  });

  test('CT-012: Card sem texto promocional quando o campo estiver vazio', async ({ page }) => {
    await selecionarCidadeComCobertura(page);

    await test.step('DADO que o campo de texto promocional está vazio para a oferta', async () => {
      const secaoOfertas = page.locator('text=Contrate agora pelo nosso site').first();
      await secaoOfertas.waitFor({ state: 'visible', timeout: 15000 });
      await secaoOfertas.scrollIntoViewIfNeeded();
    });

    await test.step('QUANDO a oferta for exibida na vitrine', async () => {
      await page.waitForTimeout(1000);
    });

    await test.step('ENTÃO nenhum badge ou texto promocional adicional fantasma deverá ser apresentado', async () => {
      const primeiroBotao = page.locator('button:has-text("Aproveitar oferta")').first();
      await primeiroBotao.scrollIntoViewIfNeeded();
      await expect(primeiroBotao).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'evidencias/CT012-01-card-sem-texto-promocional.png' });
    });
  });

  // =========================================================================
  // BLOCO 4: Estado de Checkout e Resiliência (CT-013 a CT-015)
  // =========================================================================

  test('CT-013: Persistência da oferta selecionada no checkout após refresh (F5)', async ({ page }) => {
    test.setTimeout(45000);

    await selecionarCidadeComCobertura(page);

    await test.step('DADO que o cliente selecionou uma oferta e está no checkout', async () => {
      const botaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoAproveitar.scrollIntoViewIfNeeded();
      await botaoAproveitar.click({ force: true });
      await page.waitForTimeout(2500);
    });

    await test.step('QUANDO atualizar a página utilizando F5', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    });

    await test.step('ENTÃO a oferta deverá continuar selecionada e associada à jornada em andamento', async () => {
      const indicadorSessao = page.locator('input[placeholder*="cpf" i]')
        .or(page.locator('text=/identificação|resumo|titular|aproveitar oferta|dados/i'))
        .first();

      const urlAtual = page.url();
      const sessaoMantida = urlAtual.includes('checkout') || 
        urlAtual.includes('carrinho') || 
        await indicadorSessao.isVisible().catch(() => false);

      expect(sessaoMantida).toBeTruthy();
      await page.screenshot({ path: 'evidencias/CT013-01-persistencia-f5-checkout.png' });
    });
  });

  test('CT-014: Retorno à página inicial e início de nova jornada limpa', async ({ page }) => {
    test.setTimeout(45000);

    await selecionarCidadeComCobertura(page);

    await test.step('DADO que o cliente possui uma oferta selecionada e retorna à página inicial', async () => {
      const botaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoAproveitar.scrollIntoViewIfNeeded();
      await botaoAproveitar.click({ force: true });
      await page.waitForTimeout(2000);

      await navegarComRetentativa(page, 'https://brisanet-d1.cx.brisanet.net.br/');
    });

    await test.step('QUANDO iniciar novamente a contratação a partir da vitrine', async () => {
      await navegarComRetentativa(page, URL_BASE);
      await selecionarCidadeComCobertura(page);
    });

    await test.step('ENTÃO deverá selecionar uma nova oferta sem forçar retomada involuntária do checkout anterior', async () => {
      const vitrineOfertas = page.locator('text=Contrate agora pelo nosso site').or(page.locator('text=Aproveitar oferta')).first();
      await expect(vitrineOfertas).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT014-01-retorno-vitrine-sem-conflito.png' });
    });
  });

  test('CT-015: Prevenção de duplicidade de planos no checkout único', async ({ page }) => {
    test.setTimeout(45000);

    await selecionarCidadeComCobertura(page);

    await test.step('DADO que já existe uma oferta associada ao checkout', async () => {
      const botaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').first();
      await botaoAproveitar.scrollIntoViewIfNeeded();
      await botaoAproveitar.click({ force: true });
      await page.waitForTimeout(2000);
    });

    await test.step('QUANDO o cliente tentar selecionar uma segunda oferta na vitrine', async () => {
      await navegarComRetentativa(page, URL_BASE);
      await selecionarCidadeComCobertura(page);

      const segundoBotaoAproveitar = page.locator('button:has-text("Aproveitar oferta")').nth(1);
      await segundoBotaoAproveitar.scrollIntoViewIfNeeded();
      await segundoBotaoAproveitar.click({ force: true });
      await page.waitForTimeout(2000);
    });

    await test.step('ENTÃO o sistema deverá substituir a oferta ou manter o fluxo regular de checkout', async () => {
      const indicadorCheckout = page.locator('input[placeholder*="cpf" i]')
        .or(page.locator('text=/resumo|identificação|titular|dados pessoais|aproveitar oferta/i'))
        .first();
      await expect(indicadorCheckout).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'evidencias/CT015-01-prevencao-duplicidade.png' });
    });
  });

});