# Transformação do Bolão da Copa para banco online

Este pacote transforma o bolão de `localStorage` para Supabase.

## Arquivos do pacote

- `index.html`: inclui o Supabase via CDN, o arquivo de configuração e o novo `app.js`.
- `app.js`: mantém a lógica visual/ranking, mas passa a ler e gravar no Supabase quando configurado.
- `supabase-config.js`: onde você colocará a URL e a chave pública do Supabase.
- `supabase-schema.sql`: cria as tabelas, políticas e realtime no Supabase.

## Passo a passo

### 1. Criar o projeto no Supabase

1. Entre em https://supabase.com
2. Crie um projeto.
3. Vá em **SQL Editor**.
4. Cole todo o conteúdo de `supabase-schema.sql`.
5. Clique em **Run**.

### 2. Pegar URL e chave pública

No Supabase:

1. Vá em **Project Settings**.
2. Entre em **API**.
3. Copie:
   - Project URL
   - anon public key / publishable key

### 3. Configurar o site

Abra `supabase-config.js` e preencha:

```js
window.BOLAO_SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA-CHAVE-PUBLICA",
};
```

Não use `service_role` no navegador.

### 4. Subir para o GitHub

Substitua no repositório:

- `index.html`
- `app.js`

Adicione:

- `supabase-config.js`
- `supabase-schema.sql`

Depois publique normalmente no GitHub Pages.

## Como testar

1. Abra o site em dois navegadores diferentes.
2. Cadastre um participante em um navegador.
3. Veja se aparece no outro.
4. Lance um palpite.
5. Lance um resultado.
6. Confira se o ranking muda nos dois.

## Observação importante de segurança

Esta primeira versão é funcional e rápida para colocar o bolão online. Porém, como o site está em GitHub Pages e não tem login, as políticas do Supabase estão abertas para leitura e escrita pública.

Para um bolão maior ou com dinheiro envolvido, a próxima evolução recomendada é:

- área de administrador com login;
- links individuais por participante;
- bloqueio de palpites após o horário do jogo;
- impedir que um participante edite o palpite de outro;
- esconder contato dos participantes do público.
