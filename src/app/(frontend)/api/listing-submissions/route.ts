import { randomUUID } from 'node:crypto'
import { getPayload, ValidationError } from 'payload'
import config from '@payload-config'

export async function POST(request: Request) {
  try {
    const isJSON = request.headers.get('content-type')?.includes('application/json')
    const input = isJSON ? await request.json() : Object.fromEntries(await request.formData())
    if (!isJSON) {
      for (const key of ['monthlyRent', 'deposit', 'size', 'rooms'])
        input[key] = input[key] === '' ? NaN : Number(input[key])
      input.furnished = input.furnished === 'on'
      input.petsAllowed = input.petsAllowed === 'on'
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return Response.json({ error: 'Please check your details.' }, { status: 400 })
    if (input.website)
      return Response.json({ error: 'Your listing could not be submitted.' }, { status: 400 })
    const text = (key: string) => (typeof input[key] === 'string' ? input[key].trim() : '')
    const number = (key: string) =>
      typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] : NaN
    const description = text('description')
    if (!description || description.length > 10000)
      return Response.json(
        { error: 'Please provide a description of up to 10,000 characters.' },
        { status: 400 },
      )
    const payload = await getPayload({ config })
    await payload.create({
      collection: 'listings',
      overrideAccess: false,
      user: null,
      data: {
        title: text('title'),
        slug: randomUUID(),
        status: 'pending',
        monthlyRent: number('monthlyRent'),
        deposit: number('deposit'),
        availableFrom: text('availableFrom'),
        streetAddress: text('streetAddress'),
        city: text('city'),
        size: number('size'),
        rooms: number('rooms'),
        furnished: input.furnished === true,
        petsAllowed: input.petsAllowed === true,
        landlordName: text('landlordName'),
        landlordEmail: text('landlordEmail'),
        landlordPhone: text('landlordPhone'),
        description: {
          root: {
            type: 'root',
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
            children: description.split(/\r?\n/).map((line) => ({
              type: 'paragraph',
              version: 1,
              textFormat: 0,
              textStyle: '',
              direction: 'ltr',
              format: '',
              indent: 0,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: line,
                  format: 0,
                  detail: 0,
                  mode: 'normal',
                  style: '',
                },
              ],
            })),
          },
        },
      },
    })
    // Do not return the document or private landlord details to anonymous clients.
    if (!isJSON)
      return Response.redirect(new URL('/list-your-apartment?submitted=1', request.url), 303)
    return Response.json(
      {
        message:
          'Thank you! Your apartment has been submitted. Our team will review it before it appears on Nestwell.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError)
      return Response.json(
        { error: 'Please check all required fields and try again.' },
        { status: 400 },
      )
    console.error(
      'Listing submission failed',
      error instanceof Error ? error.name : 'Unknown error',
    )
    return Response.json(
      { error: 'We could not submit your apartment right now. Please try again.' },
      { status: 500 },
    )
  }
}
