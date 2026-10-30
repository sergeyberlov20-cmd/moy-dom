window.OBJECTS = [];
fetch('js/data.json')
  .then(res => res.json())
  .then(data => {
    window.OBJECTS = data;
    document.dispatchEvent(new Event('dataLoaded'));
  })
  .catch(err => console.error('Ошибка загрузки data.json:', err));
