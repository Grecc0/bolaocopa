# Publicacao do Bolao da Copa

Este pacote contem uma versao estatica do sistema. Ele pode ser publicado em Netlify, Vercel, GitHub Pages ou qualquer hospedagem de arquivos HTML.

Arquivos principais:

- `index.html`
- `styles.css`
- `app.js`

Observacao importante: esta versao salva dados no navegador de cada usuario. Isso significa que, depois de publicado, todos conseguem acessar a pagina, mas os dados nao ficam compartilhados entre pessoas diferentes.

Para um bolao real com participantes acessando de lugares diferentes e vendo o mesmo ranking, use uma versao com backend e banco de dados.

## Netlify Drop

1. Acesse `https://app.netlify.com/drop`.
2. Arraste a pasta `bolao-copa` ou o arquivo ZIP gerado.
3. O Netlify cria uma URL publica.

## GitHub Pages

1. Crie um repositorio publico no GitHub.
2. Envie estes arquivos para a raiz do repositorio.
3. Em `Settings > Pages`, publique a partir da branch principal.

## Vercel

1. Crie um novo projeto.
2. Importe um repositorio com estes arquivos.
3. Configure como projeto estatico sem comando de build.
