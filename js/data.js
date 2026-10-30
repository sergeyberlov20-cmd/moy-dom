window.OBJECTS = [];
fetch('js/data.json')
  .then(res => res.json())
  .then(data => {
    // Умная загрузка: если пришел массив - берем его, если объект с ключом objects - берем его
    window.OBJECTS = Array.isArray(data) ? data : (data.objects || []);
    document.dispatchEvent(new Event('dataLoaded'));
  })
  .catch(err => console.error('Ошибка загрузки data.json:', err));
