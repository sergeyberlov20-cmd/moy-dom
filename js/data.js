window.OBJECTS = [];
fetch('js/data.json')
  .then(res => res.json())
  .then(data => {
    // Так как теперь файл имеет вид { "objects": [...] }, мы берем data.objects
    window.OBJECTS = data.objects || [];
    document.dispatchEvent(new Event('dataLoaded'));
  })
  .catch(err => console.error('Ошибка загрузки data.json:', err));
