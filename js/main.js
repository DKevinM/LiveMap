async function bootstrap() {
  await initMap();
  await AppData.ready;
  renderMap();
}

bootstrap();
