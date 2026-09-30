module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const raw = String(req.query?.cnpj || '');
  const cnpj = raw.replace(/\D/g, '');
  if (cnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ inválido' });
  }

  const providers = [
    {
      name: 'BrasilAPI',
      url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      valid: data => data && typeof data === 'object' && !data.message
    },
    {
      name: 'Minha Receita',
      url: `https://minhareceita.org/${cnpj}`,
      valid: data => data && typeof data === 'object' && !data.error && !data.erro
    },
    {
      name: 'ReceitaWS',
      url: `https://www.receitaws.com.br/v1/cnpj/${cnpj}`,
      valid: data => data && typeof data === 'object' && String(data.status || '').toUpperCase() !== 'ERROR'
    }
  ];

  const errors = [];
  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(provider.url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Viva-Conecta-BKO/1.9.6'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!provider.valid(data)) throw new Error('Resposta sem dados válidos');
      clearTimeout(timeout);
      return res.status(200).json({ source: provider.name, data });
    } catch (error) {
      clearTimeout(timeout);
      errors.push(`${provider.name}: ${error?.name === 'AbortError' ? 'timeout' : (error?.message || 'falha')}`);
    }
  }

  return res.status(503).json({
    error: 'Não foi possível consultar o CNPJ nas fontes disponíveis.',
    details: errors
  });
};
