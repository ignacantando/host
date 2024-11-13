  const { Pool } = require('pg');
  const { faker } = require('@faker-js/faker/locale/es');
  require('dotenv').config();
  
  const pool = new Pool({
    user: 'ignacio',
    password: '',
    host: 'localhost',
    port: 5432,
    database: 'TP'
});
  // Función auxiliar para generar fechas dentro de un rango
  const randomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };
  
  // Función auxiliar para generar DNIs únicos
  const generateUniqueDNI = () => {
    return faker.number.int({ min: 10000000, max: 99999999 }).toString();
  };
  

  const cleanDatabase = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      // Orden de eliminación respetando las dependencias
      const tables = [
        'COMENTARIO',
        'ES_VISITADA_POR',
        'RECORRIDO',
        'TIENE',
        'RONDA',
        'SE_ENCUENTRA_EN',
        'INTERNACION',
        'VACACION',
        'POSEE',
        'MEDICO',
        'PACIENTE',
        'GUARDIA',
        'ESPECIALIDAD',
        'CAMA',
        'HABITACION',
        'SECTOR'
      ];
  
      for (const table of tables) {
        await client.query(`DELETE FROM "${table}"`);
        console.log(`Tabla ${table} limpiada`);
      }
  
      await client.query('COMMIT');
      console.log('Base de datos limpiada exitosamente!');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error durante la limpieza de la base de datos:', e);
      throw e;
    } finally {
      client.release();
    }
  };

  const seedDatabase = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      // 1. Insertar Sectores
      const sectores = ['Cardiología', 'Pediatría', 'Traumatología', 'Neurología', 'Oncología'];
      const sectorIds = [];
      
      for (const sector of sectores) {
        const result = await client.query(
          'INSERT INTO "SECTOR" (id_sector, descripcion) VALUES (uuid_generate_v4(), $1) RETURNING id_sector',
          [sector]
        );
        sectorIds.push(result.rows[0].id_sector);
      }
  
      // 2. Insertar Habitaciones
      const habitacionIds = [];
      for (let i = 0; i < 20; i++) {
        // Guardamos los valores en variables para mejor legibilidad
        const piso = faker.number.int({ min: 1, max: 10 });
        const orientacion = faker.helpers.arrayElement(['Norte', 'Sur', 'Este', 'Oeste']);
        const sectorId = faker.helpers.arrayElement(sectorIds);

        const result = await client.query(
          'INSERT INTO "HABITACION" (id_habitacion, piso, orientacion, id_sector) ' +
          'VALUES (uuid_generate_v4(), $1, $2, $3) RETURNING id_habitacion',
          [piso, orientacion, sectorId]
        );
          habitacionIds.push(result.rows[0].id_habitacion);
      }
  
      // 3. Insertar Camas
      for (const habitacionId of habitacionIds) {
        const numCamas = faker.number.int({ min: 2, max: 4 });
        for (let i = 1; i <= numCamas; i++) {
          await client.query(
            'INSERT INTO "CAMA" (numero_cama, id_habitacion, disponibilidad) VALUES ($1, $2, $3)',
            [i, habitacionId, faker.datatype.boolean()]
          );
        }
      }
  
      // 4. Insertar Especialidades
      const especialidades = ['Cardiología', 'Pediatría', 'Traumatología', 'Neurología', 'Oncología', 'Cirugía General'];
      const especialidadIds = [];
      
      for (const especialidad of especialidades) {
        const result = await client.query(
          'INSERT INTO "ESPECIALIDAD" (id_especialidad, descripcion) VALUES (uuid_generate_v4(), $1) RETURNING id_especialidad',
          [especialidad]
        );
        especialidadIds.push(result.rows[0].id_especialidad);
      }
  
      // 5. Insertar Guardias (3 por especialidad)
      const turnos = [
        { inicio: '07:00', fin: '14:00', desc: 'Mañana' },
        { inicio: '14:00', fin: '21:00', desc: 'Tarde' },
        { inicio: '21:00', fin: '07:00', desc: 'Noche' }
      ];
  
      for (const espId of especialidadIds) {
        for (const turno of turnos) {
          await client.query(
            'INSERT INTO "GUARDIA" (id_guardia, hora_inicio, hora_fin, descripcion, id_especialidad) VALUES (uuid_generate_v4(), $1, $2, $3, $4)',
            [turno.inicio, turno.fin, turno.desc, espId]
          );
        }
      }
  
      // 6. Insertar Médicos
      const medicosData = [];
      for (let i = 0; i < 30; i++) {
        const dni = generateUniqueDNI();
        const result = await client.query(
          'INSERT INTO "MEDICO" (numero_matricula, nombre, cant_guardias_mes, numero_dni, apellido, foto, "CUIT", fecha_ingreso) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7) RETURNING numero_matricula',
          [
            faker.person.firstName(),
            faker.number.int({ min: 4, max: 12 }),
            dni,
            faker.person.lastName(),
            faker.image.avatar(),
            faker.number.int({ min: 20000000000, max: 29999999999 }).toString(),
            randomDate(new Date(2015, 0, 1), new Date())
          ]
        );
        medicosData.push(result.rows[0].numero_matricula);
      }
  
      // 7. Asignar especialidades a médicos
      for (const medicoMatricula of medicosData) {
        const numEspecialidades = faker.number.int({ min: 1, max: 3 });
        const especialidadesAsignadas = faker.helpers.arrayElements(especialidadIds, numEspecialidades);
        
        for (const espId of especialidadesAsignadas) {
          await client.query(
            'INSERT INTO "POSEE" (numero_matricula, id_especialidad, dispuesto_guardia) VALUES ($1, $2, $3)',
            [medicoMatricula, espId, faker.datatype.boolean()]
          );
        }
      }
  
      // 8. Insertar Pacientes
      const pacientesData = [];
      for (let i = 0; i < 50; i++) {
        const dni = generateUniqueDNI();
        const result = await client.query(
          'INSERT INTO "PACIENTE" (numero_dni, nombre, fecha_nacimiento, sexo, apellido) VALUES ($1, $2, $3, $4, $5) RETURNING numero_dni',
          [
            dni,
            faker.person.firstName(),
            faker.date.birthdate(),
            faker.helpers.arrayElement(['M', 'F']),
            faker.person.lastName()
          ]
        );
        pacientesData.push(result.rows[0].numero_dni);
      }
  
      // 9. Insertar Internaciones
      const internacionesIds = [];
      for (let i = 0; i < 40; i++) {
        const fechaInicio = randomDate(new Date(2023, 0, 1), new Date());
        // Siempre generamos una fecha_fin, sin la condición booleana
        const fechaFin = randomDate(fechaInicio, new Date(fechaInicio.getTime() + (30 * 24 * 60 * 60 * 1000)));
        const result = await client.query(
          'INSERT INTO "INTERNACION" (id_internacion, fecha_inicio, fecha_fin, numero_dni, numero_matricula) VALUES (uuid_generate_v4(), $1, $2, $3, $4) RETURNING id_internacion',
          [
            fechaInicio,
            fechaFin,
            faker.helpers.arrayElement(pacientesData),
            faker.helpers.arrayElement(medicosData)
          ]
        );
        internacionesIds.push(result.rows[0].id_internacion);
      }
  
      // 10. Asignar camas a internaciones
      for (const internacionId of internacionesIds) {
        const habitacionId = faker.helpers.arrayElement(habitacionIds);
        const camaResult = await client.query(
          'SELECT numero_cama FROM "CAMA" WHERE id_habitacion = $1 AND disponibilidad = true LIMIT 1',
          [habitacionId]
        );
        
        if (camaResult.rows.length > 0) {
          const numeroCama = camaResult.rows[0].numero_cama;
          const fecha = faker.date.recent();
    
          await client.query(
              'INSERT INTO "SE_ENCUENTRA_EN" (id_internacion, id_habitacion, numero_cama, fecha_asignacion, hora_asignacion) VALUES ($1, $2, $3, $4, $5)',
          [
            internacionId,
            habitacionId,
            numeroCama,
            fecha.toISOString().split('T')[0],         // fecha: YYYY-MM-DD
            fecha.toISOString().split('T')[1].slice(0, 12)  // hora con timezone
          ]
          );
        }
      }
  
      // 11. Insertar Rondas
      const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const rondaIds = [];
      
      for (const dia of diasSemana) {
        for (const turno of ['Mañana', 'Tarde', 'Noche']) {
          const result = await client.query(
            'INSERT INTO "RONDA" (id_ronda, dia_semana, turno) VALUES (uuid_generate_v4(), $1, $2) RETURNING id_ronda',
            [dia, turno]
          );
          rondaIds.push(result.rows[0].id_ronda);
        }
      }
  
      // 12. Asignar habitaciones a rondas
      for (const rondaId of rondaIds) {
        const numHabitaciones = faker.number.int({ min: 3, max: 8 });
        const habitacionesRonda = faker.helpers.arrayElements(habitacionIds, numHabitaciones);
        
        for (const habId of habitacionesRonda) {
          await client.query(
            'INSERT INTO "TIENE" (id_ronda, id_habitacion) VALUES ($1, $2)',
            [rondaId, habId]
          );
        }
      }
  
      // 13. Insertar Recorridos
      for (let i = 0; i < 100; i++) {
        const result = await client.query(
          'INSERT INTO "RECORRIDO" (id_recorrido, fecha_recorrido, id_ronda, numero_matricula) VALUES (uuid_generate_v4(), $1, $2, $3) RETURNING id_recorrido',
          [
            faker.date.recent(),
            faker.helpers.arrayElement(rondaIds),
            faker.helpers.arrayElement(medicosData)
          ]
        );
        
        // Asignar internaciones visitadas
        const numInternaciones = faker.number.int({ min: 1, max: 5 });
        const internacionesVisitadas = faker.helpers.arrayElements(internacionesIds, numInternaciones);
        
        for (const intId of internacionesVisitadas) {
          await client.query(
            'INSERT INTO "ES_VISITADA_POR" (id_internacion, id_recorrido) VALUES ($1, $2)',
            [intId, result.rows[0].id_recorrido]
          );
          
          // Agregar comentarios aleatorios
          if (faker.datatype.boolean()) {
            await client.query(
              'INSERT INTO "COMENTARIO" (id_comentario, texto, id_internacion, id_recorrido) VALUES (uuid_generate_v4(), $1, $2, $3)',
              [
                faker.lorem.sentence(),
                intId,
                result.rows[0].id_recorrido
              ]
            );
          }
        }
      }
  
      // 14. Insertar Vacaciones
      for (const medicoMatricula of medicosData) {
        const numVacaciones = faker.number.int({ min: 1, max: 3 });
        for (let i = 0; i < numVacaciones; i++) {
          const fechaInicio = randomDate(new Date(2023, 0, 1), new Date(2024, 11, 31));
          const fechaFin = new Date(fechaInicio.getTime() + (faker.number.int({ min: 7, max: 21 }) * 24 * 60 * 60 * 1000));
          
          await client.query(
            'INSERT INTO "VACACION" (numero_matricula, fecha_inicio, fecha_fin) VALUES ($1, $2, $3)',
            [medicoMatricula, fechaInicio, fechaFin]
          );
        }
      }
  
      await client.query('COMMIT');
      console.log('Base de datos poblada exitosamente!');
  
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error durante la población de la base de datos:', e);
      throw e;
    } finally {
      client.release();
    }
  };
  
// Función principal que maneja las opciones
const main = async () => {
  const args = process.argv.slice(2);
  const operation = args[0]?.toLowerCase();

  try {
    switch (operation) {
      case 'seed':
        console.log('Iniciando población de la base de datos...');
        await seedDatabase();
        break;
      case 'clean':
        console.log('Iniciando limpieza de la base de datos...');
        await cleanDatabase();
        break;
      case 'reset':
        console.log('Iniciando reinicio de la base de datos...');
        await cleanDatabase();
        console.log('Iniciando nueva población de la base de datos...');
        await seedDatabase();
        break;
      default:
        console.log(`
          Uso: node script.js [operación]
          
          Operaciones disponibles:
            seed   - Poblar la base de datos con datos de prueba
            clean  - Limpiar todos los datos de la base de datos
            reset  - Limpiar y volver a poblar la base de datos
          
          Ejemplo: node script.js seed
                  `);
              }
            } catch (error) {
              console.error('Error en la operación:', error);
            } finally {
              await pool.end();
            }
  };
          
          // Ejecutar el script
main().catch(console.error);