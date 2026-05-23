# Ovelhas nativo

O projeto esta preparado para funcionar de tres formas:

1. Web em producao: `https://ovelhas.vercel.app`
2. PWA instalavel no celular pela rota `/instalar`
3. App nativo via Capacitor, carregando a mesma producao

## Android

Requisitos:

- Android Studio instalado.
- JDK configurado pelo Android Studio.
- Conta Google Play Console para publicar.

Comandos:

```bash
npm run native:add:android
npm run native:sync
npm run native:open:android
```

No Android Studio:

- Gere os icones finais.
- Configure assinatura de release.
- Gere o `.aab`.
- Envie para a Play Store.

## iOS

Precisa de um Mac com Xcode.

Comandos:

```bash
npm run native:add:ios
npm run native:sync
npm run native:open:ios
```

No Xcode:

- Configure o time da Apple Developer.
- Ajuste icones e telas.
- Gere o archive.
- Envie para App Store Connect.

## Notificacoes

O app ja tem:

- notificacoes internas em `/notificacoes`;
- pedido de permissao do aparelho em `/instalar`;
- notificacoes locais para alertas urgentes/altos enquanto o app estiver em uso ou instalado;
- clique na notificacao abrindo a rota relacionada.

Para push remoto completo, o proximo passo tecnico e criar servidor de push com VAPID/FCM ou usar OneSignal/Expo Notifications.

## Observacao

O Capacitor esta configurado para carregar `https://ovelhas.vercel.app`. Assim a igreja recebe atualizacoes pela Vercel sem precisar publicar uma nova versao na loja a cada ajuste pequeno.
