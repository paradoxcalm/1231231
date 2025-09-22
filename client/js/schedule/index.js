const versionSuffix =
    typeof window !== 'undefined' && window.assetVersion
        ? `?v=${window.assetVersion}`
        : '';

import(`../schedule.js${versionSuffix}`)
    .catch((error) => {
        console.error('Не удалось загрузить модуль расписания', error);
    });
