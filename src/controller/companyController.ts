import { Request, Response } from 'express';

import {
  generateCustomId,
  // handleCreateCompany,
  handleCreateBrand,
  handleCreateCompany,
} from '@services/companyService';
import { Company, PrismaClient } from '@prisma/client';
import { uploadCompanyLogo } from '@configs/cloudStorage.config';
import dayjs from 'dayjs';
const prisma = new PrismaClient();

// {
//   invoiceDate: '2025-02-10T16:00:00.000Z',
//   packageValidityPeriod: 2,
//   pakcageTotalCredits: '15',
//   packageValue: '8000',
//   packageId: 'P02',
//   packageType: 'Basic',
//   currency: 'MYR',
//   companyName: 'Testing',
//   companyEmail: 'Testing@gmail.com',
//   companyPhone: '12312312',
//   companyAddress: 'Testing',
//   companyWebsite: 'Testing',
//   companyAbout: 'Testing',
//   companyRegistrationNumber: 'Testing123',
//   type: 'agency',
//   personInChargeName: 'TestingName',
//   personInChargeDesignation: 'TestingDesignation'
// }

// for creating new company with brand
export const createCompany = async (req: Request, res: Response) => {
  const data = JSON.parse(req.body.data);

  const companyLogo = (req.files as { companyLogo: object })?.companyLogo as { tempFilePath: string; name: string };

  try {
    let company;

    if (!companyLogo) {
      company = await handleCreateCompany(data);
    } else {
      const publicURL = await uploadCompanyLogo(companyLogo.tempFilePath, companyLogo.name);
      company = await handleCreateCompany(data, publicURL);
    }

    return res.status(201).json({ company, message: 'A new company has been created' });
  } catch (error) {
    console.log(error);
    if (error.message.includes('Company already exists')) {
      return res.status(400).json({ message: 'Company already exists' });
    }
    return res.status(400).json(error);
  }
};

export const getAllCompanies = async (_req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        brand: {
          include: {
            campaign: true,
          },
        },
        campaign: true,
        PackagesClient: true,
      },
    });
    return res.status(200).json(companies);
  } catch (err) {
    return res.status(400).json({ message: err });
  }
};

export const getCompanyById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const companies = await prisma.company.findUnique({
      where: {
        id: id,
      },
      include: {
        brand: true,
      },
    });
    return res.status(200).json(companies);
  } catch (err) {
    return res.status(400).json({ message: err });
  }
};

export const createBrand = async (req: Request, res: Response) => {
  try {
    const brand = await handleCreateBrand(req.body);
    return res.status(200).json({ brand, message: 'Brand is successfully created!' });
  } catch (err) {
    return res.status(400).json({ message: err?.message });
  }
};

export const getAllBrands = async (req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany();
    return res.status(200).json(brands);
  } catch (err) {
    return res.status(400).json({ message: err });
  }
};

export const createOneCompany = async (req: Request, res: Response) => {
  const { name, email, phone, website } = req.body;
  try {
    const company = await prisma.company.create({
      data: {
        name,
        email,
        phone,
        website,
      },
    });
    return res.status(201).json({ company });
  } catch (err) {
    return res.status(400).json({ message: err });
  }
};

export const createOneBrand = async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    client,
    brandInstagram,
    brandTiktok,
    brandFacebook,
    brandIndustries,
  }: {
    name: string;
    email: string;
    phone: string;
    brandInstagram: string;
    brandTiktok: string;
    brandFacebook: string;
    client: Company;
    brandIndustries: string[];
  } = req.body;
  try {
    const existingClient = await prisma.company.findUnique({
      where: {
        id: client.id,
      },
    });

    if (!existingClient) {
      return res.status(404).json({ message: 'Client not found.' });
    }

    const brand = await prisma.brand.create({
      data: {
        name: name,
        email: email,
        phone: phone,
        companyId: existingClient.id,
        instagram: brandInstagram,
        facebook: brandFacebook,
        tiktok: brandTiktok,
        industries: brandIndustries,
      },
    });

    return res.status(200).json({ brand, message: 'Brand created successfully.' });
  } catch (err) {
    return res.status(400).json({ message: err });
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const company = await prisma.company.findUnique({
      where: {
        id: id,
      },
      include: {
        brand: true,
      },
    });

    if (company && company.brand.length < 1) {
      await prisma.company.delete({
        where: {
          id: id,
        },
      });
      return res.status(200).json({ message: 'Sucessfully remove company' });
    }

    if (company) {
      for (const item of company.brand) {
        await prisma.brand.delete({
          where: {
            id: item.id,
          },
        });
      }
      await prisma.company.delete({
        where: {
          id: id,
        },
      });
      return res.status(200).json({ message: 'Sucessfully remove company' });
    }
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const editCompany = async (req: Request, res: Response) => {
  const {
    companyId,
    companyName,
    companyEmail,
    companyPhone,
    companyAddress,
    companyWebsite,
    companyAbout,
    companyObjectives,
    companyRegistrationNumber,
  } = JSON.parse(req.body.data);
  try {
    let logoURL = '';

    if (req.files && req.files.companyLogo) {
      const logo = (req.files as any).companyLogo;
      logoURL = await uploadCompanyLogo(logo.tempFilePath, logo.name);
    }

    const updateCompanyData = {
      name: companyName,
      about: companyAbout,
      objectives: companyObjectives,
      email: companyEmail,
      phone: companyPhone,
      address: companyAddress,
      website: companyWebsite,
      registration_number: companyRegistrationNumber,
      ...(logoURL && { logo: logoURL }),
    };

    const updatedCompany = await prisma.company.update({
      where: {
        id: companyId,
      },
      data: updateCompanyData,
    });

    return res.status(200).json({ message: 'Succesfully updated', ...updatedCompany });
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const getBrand = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const brand = await prisma.brand.findUnique({
      where: {
        id: id,
      },
      include: {
        company: true,
      },
    });
    return res.status(200).json(brand);
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const editBrand = async (req: Request, res: Response) => {
  const {
    brandId,
    brandName,
    brandEmail,
    brandPhone,
    brandInstagram,
    brandTiktok,
    brandWebsite,
    brandAbout,
    brandObjectives,
    brandIndustries,
  } = req.body;

  try {
    const updatedCompany = await prisma.brand.update({
      where: {
        id: brandId,
      },
      data: {
        name: brandName,
        description: brandAbout,
        objectives: brandObjectives,
        email: brandEmail,
        phone: brandPhone,
        instagram: brandInstagram,
        tiktok: brandTiktok,
        website: brandWebsite,
        industries: brandIndustries,
      },
    });

    return res.status(200).json({ message: 'Succesfully updated', ...updatedCompany });
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const getOptions = async (_req: Request, res: Response) => {
  try {
    const company = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        logo: true,
      },
    });

    const brand = await prisma.brand.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json([...company, ...brand]);
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const getBrandsByClientId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const brands = await prisma.brand.findMany({
      where: {
        companyId: id,
      },
    });

    return res.status(200).json(brands);
  } catch (error) {
    return res.status(400).json(error);
  }
};

export const handleLinkNewPackage = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const data = req.body;

  if (!companyId) return res.status(404).json({ message: 'Company ID not found.' });

  try {
    await prisma.$transaction(async (tx) => {
      let type;
      const company = await tx.company.findUnique({ where: { id: companyId }, include: { brand: true } });
      if (!company) throw new Error('Company not found');

      if (!company.type && company.brand.length) {
        type = await tx.company.update({ where: { id: company.id }, data: { type: 'agency' } });
      } else {
        type = await tx.company.update({ where: { id: company.id }, data: { type: 'directClient' } });
      }

      if (!company.clientId) {
        const id = await generateCustomId(type.type);
        console.log(id);
        await tx.company.update({ where: { id: company.id }, data: { clientId: id } });
      }

      const currentPackage = await tx.packages.findFirst({ where: { id: data.packageId } });

      if (!currentPackage) throw new Error('Package not found');

      await tx.packagesClient.create({
        data: {
          packageId: currentPackage.id,
          companyId: company.id,
          type: currentPackage.type,
          currency: data.currency,
          value: data.packageValue,
          totalUGCCredits: data.totalUGCCredits,
          creditsUtilized: 0,
          availableCredits: data.totalUGCCredits,
          validityPeriod: data.validityPeriod,
          invoiceDate: dayjs(data.invoiceDate).format(''),
          status: 'active',
        },
      });
    });

    return res.status(200).json({ message: 'Successfully created' });
  } catch (error) {
    console.log(error);
    return res.status(400).json(error);
  }
};
