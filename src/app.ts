import * as express from 'express'
import {Request, Response } from 'express'
import * as cors from 'cors';
import { createConnection } from 'typeorm';
import * as amqp from 'amqplib'
import 'reflect-metadata';
import { Product } from './entity/product';

createConnection().then(async (db) => {
  const productRespository = db.getMongoRepository(Product)
  try {
    const connection = await amqp.connect('amqps://lkgdchtg:QC6oAndiH8qjdCd3FOV-mAAW47y4fvLm@fox.rmq.cloudamqp.com/lkgdchtg')
    const channel = await connection.createChannel()

    channel.assertQueue('hello')
    channel.assertQueue('product_created')
    channel.assertQueue('product_updated')
    channel.assertQueue('product_deleted')

    const app = express();
    
    app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200']
    }))
    
    app.use(express.json())

    channel.consume('product_created', async(msg) => {
      const eventProduct: Product = JSON.parse(msg.content.toString())
      const  product = new Product()
      product.admin_id = parseInt(eventProduct.id)
      product.title = eventProduct.title
      product.description = eventProduct.description
      product.image = eventProduct.image
      product.likes = eventProduct.likes
      await productRespository.save(product)
      console.log('product created')
    }, {noAck: true})

    channel.consume('product_updated', async(msg) => {
      const eventProduct: Product = JSON.parse(msg.content.toString())
      console.log(eventProduct)
      const  product = await productRespository.findOne({admin_id: parseInt(eventProduct.id)})
      console.log(product, 2)
      productRespository.merge(product, {
        title: eventProduct.title,
        description: eventProduct.description,
        image: eventProduct.image,
        likes: eventProduct.likes
      })
      await productRespository.save(product)
      console.log('product updated')
    }, {noAck: true})

    channel.consume('product_deleted', async(msg) => {
      const admin_id = parseInt(msg.content.toString())
      await productRespository.deleteOne({admin_id})      
      console.log('product deleted')
    }, {noAck: true})
    app.listen(8001, () => console.log('Server running on port 8001'))
    
    process.on('beforeExit', () => {
      console.log('closing')
      connection.close()
    })
  } catch(error) {
    throw error;
  }
})
